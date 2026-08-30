// Donor matching.
//
// Synopsis section 9.b.3: "Approved requests trigger an intelligent matching algorithm
// that considers blood type, donor proximity, donation history, and eligibility."
// Section 9.b.4 adds that "selected donors are notified automatically".
//
// This module implements that algorithm. It is invoked when a request is approved
// (see controllers/donationRequest.js) and is also exposed to administrators so they can
// preview or re-run a match from the dashboard.

const Donor = require('../models/Donor');
const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const DonationHistory = require('../models/DonationHistory');
const { compatibleDonorGroups, normalize } = require('./bloodCompatibility');
const eligibility = require('./eligibility');

// Donors further away than this are not contacted at all.
const DEFAULT_RADIUS_KM = 30;
// Upper bound on how many donors a single request pages at once, so a critical request in
// a dense city does not fan out to thousands of people.
const DEFAULT_LIMIT = 25;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance between two [lng, lat] pairs.
const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const [lng1, lat1] = a;
    const [lng2, lat2] = b;
    if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return null;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Coordinates are stored inconsistently across the codebase: hospitals carry both
// `hospitalLocationGeo` and a legacy `locationGeo`, and older user documents stored
// locationGeo as a bare string. Normalise all of them to [lng, lat] or null.
const coordsOf = (geo) => {
    if (!geo || typeof geo !== 'object') return null;
    const c = geo.coordinates;
    if (Array.isArray(c) && c.length === 2 && c.every(n => typeof n === 'number' && Number.isFinite(n))) {
        // Reject the [0,0] placeholder the Hospital schema defaults to — it is the Atlantic,
        // not a real location, and would otherwise make every donor look 5000km away.
        if (c[0] === 0 && c[1] === 0) return null;
        return c;
    }
    return null;
};

const requestCoords = (request) =>
    coordsOf(request && request.hospitalLocationGeo) || coordsOf(request && request.hospitalLocation);

// Scoring weights. Proximity dominates (a donor who cannot reach the hospital in time is
// no use), then a proven donation record, then an exact blood-group match.
const WEIGHTS = { proximity: 60, history: 25, exactGroup: 15 };

const scoreCandidate = ({ distanceKm, donationCount, exactGroupMatch }, radiusKm) => {
    // Linear decay to zero at the search radius. Unknown distance scores mid-range so
    // donors without a saved location are still reachable, just ranked below located ones.
    const proximityScore = distanceKm === null
        ? 0.4
        : Math.max(0, 1 - distanceKm / radiusKm);

    // Diminishing returns: the jump from 0 to 1 prior donations matters most.
    const historyScore = Math.min(1, Math.log2(1 + (donationCount || 0)) / 3);

    return Math.round(
        proximityScore * WEIGHTS.proximity +
        historyScore * WEIGHTS.history +
        (exactGroupMatch ? WEIGHTS.exactGroup : 0)
    );
};

// Find donors who can serve a request, ranked best-first.
//
// Returns { matches, meta } where each match carries the reasons it was chosen, so the
// admin dashboard can explain the ranking rather than presenting an opaque list.
const findMatchingDonors = async (request, options = {}) => {
    const radiusKm = Number(options.radiusKm) > 0 ? Number(options.radiusKm) : DEFAULT_RADIUS_KM;
    const limit = Number(options.limit) > 0 ? Number(options.limit) : DEFAULT_LIMIT;
    const requiredGroup = normalize(request.bloodGroup);

    if (!requiredGroup) {
        return { matches: [], meta: { reason: 'Request has no recognisable blood group', radiusKm, limit } };
    }

    // 1. Blood type — every group that may donate to this patient, not just an exact match.
    const acceptableGroups = compatibleDonorGroups(requiredGroup);
    const candidates = await Donor.find({
        bloodGroup: { $in: acceptableGroups },
        userId: { $exists: true, $ne: null }
    }).lean();

    if (!candidates.length) {
        return { matches: [], meta: { reason: 'No donors registered with a compatible blood group', acceptableGroups, radiusKm, limit } };
    }

    const userIds = candidates.map(d => String(d.userId)).filter(Boolean);

    // 2. Eligibility — the 90-day gap plus health status, in one aggregate for all donors.
    const [lastDonationMap, profiles, users, donationCounts] = await Promise.all([
        eligibility.latestDonationDates(userIds),
        UserProfile.find({ userId: { $in: userIds } }).lean(),
        User.find({ _id: { $in: userIds } }).lean(),
        DonationHistory.aggregate([
            { $match: { userId: { $in: userIds }, status: { $in: eligibility.SUCCESSFUL_STATUSES } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ])
    ]);

    const profileByUser = new Map(profiles.map(p => [String(p.userId), p]));
    const userById = new Map(users.map(u => [String(u._id), u]));
    const countByUser = new Map(donationCounts.map(c => [String(c._id), c.count]));

    // 3. Proximity — measured from the hospital attached to the request.
    const origin = requestCoords(request);

    // Never match the person who raised the request to their own request.
    const requesterId = request.requestedBy ? String(request.requestedBy) : null;
    // Nor anyone who has already volunteered.
    const alreadyVolunteered = new Set((request.volunteers || []).map(v => String(v.donorId)));

    const now = new Date();
    const matches = [];
    const excluded = { ineligible: 0, tooFar: 0, inactive: 0, alreadyResponded: 0 };

    for (const donor of candidates) {
        const userId = String(donor.userId);
        if (requesterId && userId === requesterId) { excluded.alreadyResponded++; continue; }
        if (alreadyVolunteered.has(userId)) { excluded.alreadyResponded++; continue; }

        const user = userById.get(userId);
        // Deactivated or unverified accounts are not contacted.
        if (!user || user.isActive === 0 || user.isActive === false) { excluded.inactive++; continue; }

        const verdict = eligibility.evaluateDonor(donor, lastDonationMap.get(userId) || null, now);
        if (!verdict.eligible) { excluded.ineligible++; continue; }

        const profile = profileByUser.get(userId);
        const donorCoords = coordsOf(profile && profile.locationGeo) || coordsOf(user.locationGeo);
        const distanceKm = origin && donorCoords ? haversineKm(origin, donorCoords) : null;

        if (distanceKm !== null && distanceKm > radiusKm) { excluded.tooFar++; continue; }

        const donationCount = countByUser.get(userId) || 0;
        const exactGroupMatch = normalize(donor.bloodGroup) === requiredGroup;
        const score = scoreCandidate({ distanceKm, donationCount, exactGroupMatch }, radiusKm);

        matches.push({
            userId,
            donorId: String(donor._id),
            name: donor.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: donor.email || user.email,
            phoneNumber: donor.phoneNumber || user.phoneNumber,
            bloodGroup: donor.bloodGroup,
            exactGroupMatch,
            distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
            donationCount,
            lastDonationDate: verdict.lastDonationDate,
            score,
            reasons: [
                exactGroupMatch ? `Exact ${requiredGroup} match` : `${donor.bloodGroup} is compatible with ${requiredGroup}`,
                distanceKm === null ? 'Distance unknown (no saved location)' : `${Math.round(distanceKm * 10) / 10}km from the hospital`,
                donationCount > 0 ? `${donationCount} previous donation(s)` : 'No previous donations recorded',
                'Meets the 90-day gap and health criteria'
            ]
        });
    }

    // Rank best-first; ties broken by the closer donor.
    matches.sort((a, b) => (b.score - a.score) || ((a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)));

    return {
        matches: matches.slice(0, limit),
        meta: {
            requiredGroup,
            acceptableGroups,
            radiusKm,
            limit,
            hasHospitalLocation: Boolean(origin),
            candidatesConsidered: candidates.length,
            matched: Math.min(matches.length, limit),
            totalEligible: matches.length,
            excluded
        }
    };
};

module.exports = {
    findMatchingDonors,
    haversineKm,
    coordsOf,
    scoreCandidate,
    DEFAULT_RADIUS_KM,
    DEFAULT_LIMIT
};
