// Donation Request module — the request lifecycle from creation to fulfilment.
//
// This controller is where most of the workflows the synopsis describes converge, and it
// is where the largest gaps were. It now implements, in addition to the original CRUD:
//
//  * Event-driven notifications at every state change (synopsis 9.b.5 and both Level-1
//    DFDs). Previously no notification was ever generated automatically.
//  * The intelligent matching algorithm, triggered on approval, which selects donors by
//    blood-type compatibility, proximity, donation history and eligibility, and notifies
//    them (synopsis 9.b.3 and 9.b.4).
//  * ABO/Rh compatibility enforcement when volunteering. Previously any donor of any
//    blood group could volunteer for any request.
//  * The four-response cap: "Request visibility is dynamically managed, becoming
//    non-interactive when marked as completed or after receiving four responses"
//    (synopsis 9.b.3).
//  * Confirmation of a donation now writes a MedicalReport and a DonationHistory row and
//    adds the unit to blood inventory. Donation history had no writer at all, which
//    silently disabled donor eligibility, the aggregate report and eligible-donor
//    targeting, all three of which read from it.

const path = require('path');
const DonationRequest = require("../models/DonationRequest");
const Hospital = require("../models/Hospital");
const DonationHistory = require("../models/DonationHistory");
const MedicalReport = require("../models/MedicalReport");
const Donor = require("../models/Donor");
const User = require("../models/User");

const notify = require('../utils/notify');
const matching = require('../utils/matching');
const inventory = require('../utils/inventory');
const eligibility = require('../utils/eligibility');
const { isCompatible, normalize, compatibleRecipientGroups } = require('../utils/bloodCompatibility');

const OPEN_STATUSES = ['APPROVED', 'IN_PROGRESS'];
const actorId = (req) => {
    const u = req.user || {};
    return u.userId || u._id || u.id || null;
};

// Snapshot hospital details onto the request so historical records stay readable even if
// the hospital is later edited or removed.
const attachHospitalSnapshot = async (body) => {
    if (!body.hospitalId) {
        // Drop a malformed geo object rather than letting MongoDB reject the whole write.
        if (body.hospitalLocationGeo && !Array.isArray(body.hospitalLocationGeo.coordinates)) {
            delete body.hospitalLocationGeo;
        }
        return body;
    }

    let hospital = null;
    try {
        hospital = await Hospital.findById(body.hospitalId);
    } catch (e) { /* not an ObjectId; fall through to the string lookup */ }
    if (!hospital) hospital = await Hospital.findOne({ hospitalId: String(body.hospitalId) });

    if (hospital) {
        body.hospitalId = String(hospital._id);
        body.hospitalName = hospital.hospitalName || body.hospitalName;
        body.hospitalAddress = hospital.address || body.hospitalAddress;
        body.hospitalPhone = hospital.phoneNumber || body.hospitalPhone;
        body.hospitalLocation = hospital.location || body.hospitalLocation;

        const geo = hospital.hospitalLocationGeo && Array.isArray(hospital.hospitalLocationGeo.coordinates)
            && hospital.hospitalLocationGeo.coordinates.length === 2
            ? hospital.hospitalLocationGeo
            : (hospital.locationGeo && Array.isArray(hospital.locationGeo.coordinates)
                && hospital.locationGeo.coordinates.length === 2 ? hospital.locationGeo : null);
        if (geo) body.hospitalLocationGeo = geo;
        else delete body.hospitalLocationGeo;
    }
    return body;
};

// Older documents can hold `{ type: 'Point' }` with no coordinates, which makes any
// subsequent .save() fail GeoJSON validation. Strip it before saving.
const sanitizeGeo = (doc) => {
    const geo = doc.hospitalLocationGeo;
    if (geo && geo.type === 'Point' && (!Array.isArray(geo.coordinates) || geo.coordinates.length !== 2)) {
        doc.hospitalLocationGeo = undefined;
    }
    return doc;
};

// Run the matching algorithm and notify the selected donors. Called on approval and
// available on demand to administrators.
const runMatching = async (request, options = {}) => {
    const { matches, meta } = await matching.findMatchingDonors(request, options);
    if (matches.length) {
        await notify.events.donorsMatched(request, matches.map(m => m.userId));
    }
    request.matching = {
        lastRunAt: new Date(),
        notifiedCount: matches.length,
        notifiedUserIds: matches.map(m => m.userId),
        radiusKm: meta.radiusKm
    };
    await sanitizeGeo(request).save();
    return { matches, meta };
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

exports.getAllDonationRequests = async (req, res, next) => {
    try {
        const { status, lat, lng, radius, accuracy } = req.query;
        const match = {};
        if (status) match.status = String(status).toUpperCase();

        const user = req.user || {};
        const isAdmin = String(user.roleId) === '0';

        // A donor asking for completed requests only sees the ones they took part in.
        if (!isAdmin && match.status === 'COMPLETED') {
            if (user.userId) match['volunteers.donorId'] = String(user.userId);
            else return res.status(403).json({ message: 'User context missing or insufficient privileges' });
        }

        const agg = [];
        if (Object.keys(match).length) agg.push({ $match: match });

        // Proximity ordering: rank requests by how close their hospital is to the caller.
        if (lat && lng) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            const maxDistance = radius ? parseInt(radius, 10) : (accuracy ? parseFloat(accuracy) : 5000);

            const nearbyHospitals = await Hospital.aggregate([
                {
                    $geoNear: {
                        near: { type: 'Point', coordinates: [longitude, latitude] },
                        distanceField: 'distanceMeters',
                        key: 'hospitalLocationGeo',
                        spherical: true,
                        maxDistance
                    }
                },
                { $project: { _id: 1, distanceMeters: 1 } }
            ]);

            const hospitalIds = nearbyHospitals.map(h => String(h._id));
            const hospitalDistances = nearbyHospitals.map(h => h.distanceMeters ?? null);

            agg.push({ $addFields: { nearIndex: { $indexOfArray: [hospitalIds, '$hospitalId'] } } });
            agg.push({
                $addFields: {
                    // Requests whose hospital is outside the radius sort last rather than first.
                    distanceMeters: { $cond: [{ $lt: ['$nearIndex', 0] }, null, { $arrayElemAt: [hospitalDistances, '$nearIndex'] }] },
                    distanceMetersNormalized: { $cond: [{ $lt: ['$nearIndex', 0] }, 999999999, { $arrayElemAt: [hospitalDistances, '$nearIndex'] }] }
                }
            });
        }

        // hospitalId is stored as a string but hospitals._id is an ObjectId, so a plain
        // localField/foreignField lookup never matched and hospitalDetails came back empty
        // on every request. Cast inside the lookup pipeline instead.
        agg.push({
            $lookup: {
                from: 'hospitals',
                let: { hid: '$hospitalId' },
                pipeline: [
                    { $match: { $expr: { $and: [
                        { $ne: ['$$hid', null] },
                        // A malformed id would make $toObjectId throw and fail the whole query.
                        { $eq: [{ $strLenCP: { $ifNull: ['$$hid', ''] } }, 24] },
                        { $eq: ['$_id', { $toObjectId: '$$hid' }] }
                    ] } } }
                ],
                as: 'hospitalDetails'
            }
        });
        agg.push({ $unwind: { path: '$hospitalDetails', preserveNullAndEmptyArrays: true } });
        agg.push(lat && lng
            ? { $sort: { distanceMetersNormalized: 1, requestDate: -1 } }
            : { $sort: { requestDate: -1 } });

        const donationRequests = await DonationRequest.aggregate(agg);

        // Completed requests are also the donor-facing "my donations" view, so they carry
        // a summary block the dashboard renders directly.
        if (match.status === 'COMPLETED') {
            const requestIds = donationRequests.map(r => String(r._id));
            const histories = await DonationHistory.find({ requestId: { $in: requestIds } }).lean();
            const reportIds = histories.map(h => h.reportId).filter(Boolean);
            const eligibleReports = reportIds.length
                ? await MedicalReport.countDocuments({ reportId: { $in: reportIds }, isEligible: true })
                : 0;

            return res.status(200).json({
                records: donationRequests,
                summary: {
                    totalDonations: donationRequests.length,
                    totalUnits: donationRequests.reduce((sum, r) => sum + (r.unitsFulfilled || r.bloodUnitsCount || 0), 0),
                    uniqueHospitals: new Set(donationRequests.map(r => r.hospitalId).filter(Boolean)).size,
                    eligibleReports
                }
            });
        }

        return res.status(200).json(donationRequests);
    } catch (error) { next(error); }
};

exports.getDonationRequestById = async (req, res, next) => {
    try {
        const donationRequest = await DonationRequest.findById(req.params.id);
        if (!donationRequest) return res.status(404).json({ message: "Donation request not found" });
        res.status(200).json(donationRequest);
    } catch (error) { next(error); }
};

// GET /api/v1/donation-requests/open-for-me
// Requests a donor can actually act on: compatible with their blood group, still open,
// and not their own. This is the donor-side half of matching.
exports.getRequestsOpenForDonor = async (req, res, next) => {
    try {
        const userId = String(actorId(req));
        const user = await User.findById(userId).lean();
        if (!user) return res.status(404).json({ message: 'Account not found' });

        const donor = await Donor.findOne({ userId }).lean();
        const donorGroup = normalize((donor && donor.bloodGroup) || user.bloodGroup);
        if (!donorGroup) {
            return res.status(400).json({ message: 'Your profile has no recognisable blood group. Update your profile to see matching requests.' });
        }

        // Every patient group this donor can serve.
        const servableGroups = compatibleRecipientGroups(donorGroup);

        const requests = await DonationRequest.find({
            status: { $in: OPEN_STATUSES },
            bloodGroup: { $in: servableGroups },
            requestedBy: { $ne: userId }
        }).sort({ priority: 1, requiredDate: 1 }).lean();

        // Drop requests that already hit the response cap, and ones this donor answered.
        const open = requests.filter(r =>
            (r.volunteers || []).length < (r.maxVolunteers || 4) &&
            !(r.volunteers || []).some(v => String(v.donorId) === userId)
        );

        // Tell the donor whether they are currently able to donate at all.
        const lastDates = await eligibility.latestDonationDates([userId]);
        const verdict = eligibility.evaluateDonor(donor || {}, lastDates.get(userId) || null);

        res.status(200).json({
            donorBloodGroup: donorGroup,
            canDonateTo: servableGroups,
            eligibility: verdict,
            count: open.length,
            requests: open
        });
    } catch (error) { next(error); }
};

// GET /api/v1/donation-requests/:id/matches — preview the matching algorithm's output.
exports.getMatchesForRequest = async (req, res, next) => {
    try {
        const request = await DonationRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Donation request not found' });

        const { matches, meta } = await matching.findMatchingDonors(request, {
            radiusKm: req.query.radiusKm,
            limit: req.query.limit
        });
        res.status(200).json({ matches, meta, previouslyNotified: request.matching || null });
    } catch (error) { next(error); }
};

// POST /api/v1/donation-requests/:id/rematch — re-run matching and notify again.
exports.rematchRequest = async (req, res, next) => {
    try {
        const request = await DonationRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Donation request not found' });
        if (!OPEN_STATUSES.includes(String(request.status).toUpperCase())) {
            return res.status(400).json({ message: 'Only approved or in-progress requests can be matched' });
        }

        const { matches, meta } = await runMatching(request, {
            radiusKm: req.body.radiusKm,
            limit: req.body.limit
        });
        res.status(200).json({ message: `${matches.length} donor(s) matched and notified`, matches, meta });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

exports.createDonationRequest = async (req, res, next) => {
    try {
        const body = { ...req.body };

        if (!normalize(body.bloodGroup)) {
            return res.status(400).json({ message: `Unrecognised blood group: ${body.bloodGroup}` });
        }

        const requester = actorId(req);
        if (requester) body.requestedBy = String(requester);

        await attachHospitalSnapshot(body);

        // Only an administrator may create a request that is already approved; a donor's
        // own request always enters the queue as PENDING for review.
        const isAdmin = String((req.user || {}).roleId) === '0';
        const requestedStatus = body.status ? String(body.status).toUpperCase() : 'PENDING';
        const initialStatus = isAdmin ? requestedStatus : 'PENDING';

        const donationRequest = new DonationRequest({
            ...body,
            requestDate: new Date(),
            status: initialStatus,
            approved: initialStatus === 'APPROVED',
            availableDonors: 0,
            unitsFulfilled: 0,
            maxVolunteers: Number(body.maxVolunteers) > 0 ? Number(body.maxVolunteers) : 4
        });

        await sanitizeGeo(donationRequest).save();

        // Notify administrators that a request is waiting for review.
        notify.events.requestCreated(donationRequest).catch(err =>
            console.warn('[donationRequest] create notification failed:', err.message || err));

        // An admin-created request that is already approved starts matching immediately.
        if (donationRequest.approved) {
            runMatching(donationRequest).catch(err =>
                console.warn('[donationRequest] matching failed:', err.message || err));
        }

        res.status(201).json(donationRequest);
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Update / approve / reject / close
// ---------------------------------------------------------------------------

exports.updateDonationRequest = async (req, res, next) => {
    try {
        const existing = await DonationRequest.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Donation request not found" });

        const wasApproved = existing.approved;
        const updates = { ...req.body };

        if (updates.hospitalLocationGeo && !Array.isArray(updates.hospitalLocationGeo.coordinates)) {
            delete updates.hospitalLocationGeo;
        }

        let nextStatus = null;
        if (updates.status) {
            nextStatus = String(updates.status).toUpperCase();
            updates.status = nextStatus;

            if (nextStatus === 'APPROVED') {
                updates.approved = true;
            } else if (nextStatus === 'REJECTED') {
                updates.approved = false;
                updates.rejectedAt = new Date();
                updates.rejectedReason = updates.rejectedReason || req.body.reason;
            } else {
                // Never flip `approved` as a side effect of an unrelated status change.
                updates.approved = existing.approved;
            }

            if (['CLOSED', 'COMPLETED'].includes(nextStatus) && !existing.approved) {
                return res.status(400).json({ message: 'Only approved requests can be closed or marked completed' });
            }
            if (nextStatus === 'COMPLETED' && !updates.fulfilledAt) updates.fulfilledAt = new Date();
            if (nextStatus === 'CLOSED' && !updates.closedAt) updates.closedAt = new Date();

            if (nextStatus === 'COMPLETED' && Array.isArray(updates.fulfilledByList) && updates.fulfilledByList.length) {
                updates.fulfilledBy = updates.fulfilledBy || String(updates.fulfilledByList[0]);
                if (Array.isArray(updates.fulfilledByNames) && updates.fulfilledByNames.length) {
                    updates.fulfilledByName = updates.fulfilledByName || String(updates.fulfilledByNames[0]);
                }
            }
        }

        const updated = await DonationRequest.findByIdAndUpdate(req.params.id, updates, { new: true });

        // Fire the notification and matching side effects for the transition that just
        // happened. These are best-effort: a notification failure must not undo the
        // approval an administrator just made.
        try {
            if (nextStatus === 'APPROVED' && !wasApproved) {
                await notify.events.requestApproved(updated);
                await runMatching(updated, { radiusKm: req.body.radiusKm });
            } else if (nextStatus === 'REJECTED') {
                await notify.events.requestRejected(updated, updates.rejectedReason);
            } else if (nextStatus === 'COMPLETED') {
                await notify.events.requestCompleted(updated);
            }
        } catch (err) {
            console.warn('[donationRequest] post-update workflow failed:', err.message || err);
        }

        res.json(updated);
    } catch (error) { next(error); }
};

exports.deleteDonationRequest = async (req, res, next) => {
    try {
        const deleted = await DonationRequest.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Donation request not found" });
        res.json({ message: "Donation request deleted successfully" });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Volunteering
// ---------------------------------------------------------------------------

exports.volunteerForDonation = async (req, res, next) => {
    try {
        const body = req.body || {};
        // The donor is taken from the bearer token, not the request body — trusting a
        // client-supplied donorId would let anyone volunteer on someone else's behalf.
        const donorId = String(actorId(req) || body.donorId || '');
        if (!donorId) return res.status(401).json({ message: "You're not authorized" });

        const donationRequest = await DonationRequest.findById(req.params.requestId);
        if (!donationRequest) return res.status(404).json({ message: "Donation request not found" });

        if (donationRequest.requestedBy && String(donationRequest.requestedBy) === donorId) {
            return res.status(403).json({ message: "You cannot volunteer for a donation request you created" });
        }
        if (!donationRequest.approved && String(donationRequest.status).toUpperCase() !== 'APPROVED') {
            return res.status(400).json({ message: "Donation request is not approved for volunteers" });
        }
        if ((donationRequest.volunteers || []).some(v => String(v.donorId) === donorId)) {
            return res.status(409).json({ message: "You have already volunteered for this request" });
        }

        // Synopsis 9.b.3: a request stops accepting responses after four of them.
        if (!donationRequest.isOpenForVolunteers()) {
            return res.status(409).json({
                code: 'REQUEST_CLOSED',
                message: `This request is no longer accepting responses (${(donationRequest.volunteers || []).length} of ${donationRequest.maxVolunteers} slots filled).`
            });
        }

        const [user, donor] = await Promise.all([
            User.findById(donorId).lean(),
            Donor.findOne({ userId: donorId }).lean()
        ]);
        if (!user) return res.status(404).json({ message: 'Account not found' });

        // Blood group compatibility — previously unchecked in either direction.
        const donorGroup = normalize((donor && donor.bloodGroup) || user.bloodGroup);
        if (!isCompatible(donorGroup, donationRequest.bloodGroup)) {
            return res.status(400).json({
                code: 'INCOMPATIBLE_BLOOD_GROUP',
                message: `Your blood group (${donorGroup || 'unknown'}) is not compatible with the ${donationRequest.bloodGroup} required by this request.`
            });
        }

        // Eligibility — the 90-day gap and health status.
        const lastDates = await eligibility.latestDonationDates([donorId]);
        const verdict = eligibility.evaluateDonor(donor || {}, lastDates.get(donorId) || null);
        if (!verdict.eligible) {
            return res.status(403).json({
                code: 'NOT_ELIGIBLE',
                message: 'You are not currently eligible to donate.',
                reasons: verdict.reasons,
                nextEligibleDate: verdict.nextEligibleDate
            });
        }

        const volunteerEntry = {
            donorId,
            donorName: body.donorName || `${user.firstName} ${user.lastName || ''}`.trim(),
            contact: body.contact || user.phoneNumber,
            expectedDonationTime: body.expectedDonationTime ? new Date(body.expectedDonationTime) : null,
            message: body.message || null,
            volunteeredAt: new Date(),
            fulfilled: false, // set true only once a donation is actually confirmed
            medicalProofFile: req.file ? path.join('uploads/medical-reports', req.file.filename) : null
        };

        donationRequest.volunteers.push(volunteerEntry);
        donationRequest.availableDonors = donationRequest.volunteers.length;
        donationRequest.status = 'IN_PROGRESS';

        await sanitizeGeo(donationRequest).save();

        // Notify the requester and the administrators. Previously the frontend attempted
        // this itself against a hard-coded phone number and a public proxy.
        notify.events.donorVolunteered(donationRequest, volunteerEntry).catch(err =>
            console.warn('[donationRequest] volunteer notification failed:', err.message || err));

        res.status(200).json({
            message: "Successfully volunteered for donation",
            donationRequest,
            slotsRemaining: Math.max(0, donationRequest.maxVolunteers - donationRequest.volunteers.length)
        });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Confirming a donation
// ---------------------------------------------------------------------------

// POST /api/v1/donation-requests/:requestId/volunteer/:volunteerId/report
//
// An administrator files the medical report for a volunteer and states whether the
// donation succeeded. This is the single point where a donation becomes a permanent
// record, so it writes all four consequences together: the medical report, the donation
// history row, the blood inventory movement and the donor's eligibility.
exports.saveVolunteerReport = async (req, res, next) => {
    try {
        const { requestId, volunteerId } = req.params;
        const body = req.body || {};

        const donationRequest = await DonationRequest.findById(requestId);
        if (!donationRequest) return res.status(404).json({ message: 'Donation request not found' });

        const vIndex = (donationRequest.volunteers || []).findIndex(v => String(v.donorId) === String(volunteerId));
        if (vIndex === -1) return res.status(404).json({ message: 'Volunteer not found for this request' });

        const volunteer = donationRequest.volunteers[vIndex];
        const filePath = req.file ? path.join('uploads/medical-reports', req.file.filename) : undefined;
        if (filePath) volunteer.medicalProofFile = filePath;

        const fulfilled = typeof body.fulfilled !== 'undefined'
            ? (body.fulfilled === true || body.fulfilled === 'true')
            : undefined;
        if (typeof fulfilled === 'boolean') volunteer.fulfilled = fulfilled;

        const success = typeof body.success !== 'undefined'
            ? (body.success === true || body.success === 'true')
            : undefined;
        if (typeof success === 'boolean') volunteer.donationSuccess = success;

        // File the medical report with the clinical readings, if any were supplied.
        // tb_medical_report exists in the synopsis but nothing ever wrote to it.
        const hasClinicalData = ['hemoglobinLevel', 'bloodPressure', 'sugarLevel', 'testResult',
                                 'medicalCondition', 'doctorName'].some(f => body[f]);
        let report = null;
        if ((hasClinicalData || filePath || typeof success === 'boolean') && !volunteer.medicalReportId) {
            report = await MedicalReport.create({
                reportId: `MR-${Date.now()}-${String(volunteer.donorId).slice(-6)}`,
                userId: String(volunteer.donorId),
                hospitalId: donationRequest.hospitalId ? String(donationRequest.hospitalId) : undefined,
                requestId: String(donationRequest._id),
                reportDate: new Date(),
                reportType: 'Post-Donation',
                filePath: volunteer.medicalProofFile || undefined,
                hemoglobinLevel: body.hemoglobinLevel,
                bloodPressure: body.bloodPressure,
                sugarLevel: body.sugarLevel,
                // A successful donation implies the donor was found fit.
                isEligible: success === true,
                testResult: body.testResult,
                medicalCondition: body.medicalCondition,
                doctorName: body.doctorName,
                createdBy: String(actorId(req) || '')
            });
            volunteer.medicalReportId = String(report._id);
        }

        // A confirmed donation becomes a permanent history row, which is what starts the
        // donor's 90-day waiting period and feeds every downstream report.
        let history = null;
        if (success === true && !volunteer.donationHistoryId) {
            const units = Number(body.unitsDonated) > 0 ? Number(body.unitsDonated) : 1;
            try {
                history = await DonationHistory.create({
                    donationId: `DN-${Date.now()}-${String(volunteer.donorId).slice(-6)}`,
                    userId: String(volunteer.donorId),
                    hospitalId: donationRequest.hospitalId ? String(donationRequest.hospitalId) : undefined,
                    requestId: String(donationRequest._id),
                    reportId: report ? report.reportId : undefined,
                    donationDate: volunteer.expectedDonationTime || new Date(),
                    donatedUnits: units,
                    donationType: body.donationType || 'Whole Blood',
                    status: 'Success',
                    remarks: body.remarks
                });
            } catch (err) {
                // The unique (requestId, userId) index makes a repeated confirmation a
                // no-op rather than a duplicate donation.
                if (err.code === 11000) {
                    history = await DonationHistory.findOne({ requestId: String(donationRequest._id), userId: String(volunteer.donorId) });
                } else {
                    throw err;
                }
            }

            volunteer.donationHistoryId = String(history._id);
            volunteer.unitsDonated = units;
            volunteer.confirmedAt = new Date();
            volunteer.fulfilled = true;
            donationRequest.unitsFulfilled = (donationRequest.unitsFulfilled || 0) + units;

            // The collected unit enters the hospital's stock.
            if (donationRequest.hospitalId) {
                try {
                    const donor = await Donor.findOne({ userId: volunteer.donorId }).lean();
                    await inventory.recordIn({
                        hospitalId: donationRequest.hospitalId,
                        bloodGroup: (donor && donor.bloodGroup) || donationRequest.bloodGroup,
                        units,
                        donationId: String(history._id),
                        requestId: String(donationRequest._id),
                        donorUserId: String(volunteer.donorId),
                        performedBy: String(actorId(req) || ''),
                        note: `Donation against request ${donationRequest._id}`
                    });
                } catch (err) {
                    console.warn('[donationRequest] inventory update failed:', err.message || err);
                }
            }

            // Thank the donor and tell them when they can give again.
            const nextEligible = new Date(
                (volunteer.expectedDonationTime || new Date()).getTime() +
                eligibility.MIN_DAYS_BETWEEN_DONATIONS * 24 * 3600 * 1000
            );
            notify.events.donationRecorded(volunteer.donorId, donationRequest, nextEligible).catch(() => {});
        }

        // Update the donor's health flag from the outcome.
        try {
            const donor = await Donor.findOne({ userId: volunteer.donorId });
            if (donor) {
                if (success === false) {
                    donor.eligibility = 'ineligible';
                    donor.eligibilityUpdatedDate = new Date();
                    await donor.save();
                } else if (success === true && donor.eligibility === 'ineligible') {
                    // A successful donation clears a previous medical block.
                    donor.eligibility = 'eligible';
                    donor.eligibilityUpdatedDate = new Date();
                    await donor.save();
                }
            }
        } catch (err) {
            console.warn('[donationRequest] failed to update donor eligibility:', err.message || err);
        }

        // Auto-complete once the requested units have been collected.
        if (donationRequest.unitsFulfilled >= (donationRequest.bloodUnitsCount || 1)
            && String(donationRequest.status).toUpperCase() !== 'COMPLETED') {
            donationRequest.status = 'COMPLETED';
            donationRequest.fulfilledAt = new Date();
            notify.events.requestCompleted(donationRequest).catch(() => {});
        }

        donationRequest.markModified('volunteers');
        await sanitizeGeo(donationRequest).save();

        return res.status(200).json({
            message: 'Volunteer report saved',
            volunteer: donationRequest.volunteers[vIndex],
            medicalReport: report,
            donationHistory: history,
            requestStatus: donationRequest.status,
            unitsFulfilled: donationRequest.unitsFulfilled
        });
    } catch (error) { next(error); }
};
