// Donor eligibility rules — single source of truth.
//
// Synopsis section 9.b.2: "Eligibility is verified through criteria like blood group
// compatibility, a 3-month gap since the last donation, and health status."
//
// Before this module three different gaps were hard-coded in three places (180 days in
// controllers/donor.js, 30 days in controllers/notification.js, none elsewhere). Every
// caller now goes through here so the rule is stated once.

const DonationHistory = require('../models/DonationHistory');

// 3 months, as specified in the synopsis.
const MIN_DAYS_BETWEEN_DONATIONS = 90;
const MIN_AGE = 18;
const MAX_AGE = 65;
const MIN_WEIGHT_KG = 45;

const DAY_MS = 1000 * 60 * 60 * 24;

// A donation counts against the waiting period once it actually happened.
const SUCCESSFUL_STATUSES = ['Success', 'Completed'];

const daysBetween = (from, to) => (to.getTime() - new Date(from).getTime()) / DAY_MS;

// Latest successful donation date per user, for a set of user ids.
// Returns Map<userIdString, Date>. One aggregate for the whole set rather than a query
// per donor — the previous per-donor loop was O(n) round trips.
const latestDonationDates = async (userIds) => {
    const ids = (userIds || []).map(String).filter(Boolean);
    if (ids.length === 0) return new Map();

    const rows = await DonationHistory.aggregate([
        { $match: { userId: { $in: ids }, status: { $in: SUCCESSFUL_STATUSES }, donationDate: { $exists: true, $ne: null } } },
        { $group: { _id: '$userId', latestDate: { $max: '$donationDate' } } }
    ]);

    return new Map(rows.map(r => [String(r._id), new Date(r.latestDate)]));
};

// Days remaining before a donor may give again (0 when they are already clear).
const daysUntilNextDonation = (lastDonationDate, now = new Date()) => {
    if (!lastDonationDate) return 0;
    const elapsed = daysBetween(lastDonationDate, now);
    return Math.max(0, Math.ceil(MIN_DAYS_BETWEEN_DONATIONS - elapsed));
};

// Evaluate one donor. `lastDonationDate` comes from latestDonationDates() so the caller
// can evaluate a whole page of donors with a single database round trip.
//
// Returns { eligible, status, reasons[], nextEligibleDate, daysUntilEligible }.
const evaluateDonor = (donor, lastDonationDate, now = new Date()) => {
    const reasons = [];

    // A medical report marked "not fit to donate" hard-blocks the donor until an admin
    // clears them again (controllers/donationRequest.js sets this from the report).
    if (donor && donor.eligibility === 'ineligible') {
        reasons.push('Marked ineligible following a medical assessment');
    }

    if (donor && donor.diseases && !/^(no|none|nil|n\/a)$/i.test(String(donor.diseases).trim())) {
        reasons.push(`Declared medical condition: ${donor.diseases}`);
    }

    const age = Number(donor && donor.age);
    if (Number.isFinite(age) && age > 0) {
        if (age < MIN_AGE) reasons.push(`Below the minimum donation age of ${MIN_AGE}`);
        if (age > MAX_AGE) reasons.push(`Above the maximum donation age of ${MAX_AGE}`);
    }

    const weight = parseFloat(donor && donor.weight);
    if (Number.isFinite(weight) && weight > 0 && weight < MIN_WEIGHT_KG) {
        reasons.push(`Below the minimum donation weight of ${MIN_WEIGHT_KG}kg`);
    }

    const waitDays = daysUntilNextDonation(lastDonationDate, now);
    if (waitDays > 0) {
        reasons.push(`${waitDays} day(s) remaining of the ${MIN_DAYS_BETWEEN_DONATIONS}-day gap since the last donation`);
    }

    const nextEligibleDate = lastDonationDate
        ? new Date(new Date(lastDonationDate).getTime() + MIN_DAYS_BETWEEN_DONATIONS * DAY_MS)
        : null;

    return {
        eligible: reasons.length === 0,
        status: reasons.length === 0 ? 'eligible' : 'ineligible',
        reasons,
        lastDonationDate: lastDonationDate || null,
        nextEligibleDate,
        daysUntilEligible: waitDays
    };
};

// Convenience wrapper: evaluate a list of donors, fetching their donation dates in one go.
// Each donor must expose `userId` (or `_id`) so history can be matched.
const evaluateDonors = async (donors, now = new Date()) => {
    const list = donors || [];
    const keyOf = (d) => String((d && (d.userId || d._id)) || '');
    const dateMap = await latestDonationDates(list.map(keyOf));
    return list.map(donor => ({
        donor,
        ...evaluateDonor(donor, dateMap.get(keyOf(donor)) || null, now)
    }));
};

module.exports = {
    MIN_DAYS_BETWEEN_DONATIONS,
    MIN_AGE,
    MAX_AGE,
    MIN_WEIGHT_KG,
    SUCCESSFUL_STATUSES,
    latestDonationDates,
    daysUntilNextDonation,
    evaluateDonor,
    evaluateDonors
};
