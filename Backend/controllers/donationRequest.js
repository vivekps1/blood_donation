const DonationRequest = require("../models/DonationRequest");
const Hospital = require("../models/Hospital");
const DonationHistory = require("../models/DonationHistory");
const MedicalReport = require("../models/MedicalReport");

// Get all donation requests
exports.getAllDonationRequests = async (req, res) => {
    try {
        const { status, lat, lng, radius } = req.query;
        let match = {};
        if (status) {
            match.status = typeof status === 'string' ? status.toUpperCase() : status;
        }

        // If latitude/longitude provided, find nearby hospitals first and prioritize requests from them
        if (lat && lng) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            const maxDistance = radius ? parseInt(radius) : 5000; // meters

            // Find nearby hospitals (live data) ordered by proximity
            const nearbyHospitals = await Hospital.aggregate([
                {
                    $geoNear: {
                        near: { type: 'Point', coordinates: [longitude, latitude] },
                        distanceField: 'distanceMeters',
                        key: 'locationGeo',
                        spherical: true,
                        maxDistance: maxDistance
                    }
                },
                { $project: { _id: 1, distanceMeters: 1 } }
            ]);

            // Build arrays of hospital ids (as strings) and distances to use inside aggregation
            const hospitalIds = nearbyHospitals.map(h => String(h._id));
            const hospitalDistances = nearbyHospitals.map(h => h.distanceMeters || null);

            // Aggregate donation requests, compute index of hospitalId in nearby list and sort by that index
            const agg = [];
            if (Object.keys(match).length) agg.push({ $match: match });

            // Add nearIndex (position in hospitalIds) and normalized index for sorting
            agg.push({
                $addFields: {
                    nearIndex: { $indexOfArray: [hospitalIds, '$hospitalId'] }
                }
            });
            agg.push({
                $addFields: {
                    nearIndexNormalized: { $cond: [{ $lt: ['$nearIndex', 0] }, 999999, '$nearIndex'] },
                    hospitalDistance: { $cond: [{ $lt: ['$nearIndex', 0] }, null, { $arrayElemAt: [hospitalDistances, '$nearIndex'] }] }
                }
            });

            // Lookup live hospital details for display
            agg.push({
                $lookup: {
                    from: 'hospitals',
                    localField: 'hospitalId',
                    foreignField: '_id',
                    as: 'hospitalDetails'
                }
            });
            agg.push({ $unwind: { path: '$hospitalDetails', preserveNullAndEmptyArrays: true } });

            // Sort requests: nearby hospitals first (nearIndexNormalized asc), then fallback by createdAt desc
            agg.push({ $sort: { nearIndexNormalized: 1, requestDate: -1 } });

            const results = await DonationRequest.aggregate(agg);

            return res.status(200).json(results);
        }

        // Otherwise just return matched requests with hospital lookup
        const agg = [];
        if (Object.keys(match).length) agg.push({ $match: match });
        agg.push({
            $lookup: {
                from: 'hospitals',
                localField: 'hospitalId',
                foreignField: '_id',
                as: 'hospitalDetails'
            }
        });
        agg.push({ $unwind: { path: '$hospitalDetails', preserveNullAndEmptyArrays: true } });

        const donationRequests = await DonationRequest.aggregate(agg);
        
        // If requesting completed summary, compute summary
        if (match.status === 'COMPLETED') {
            const totalDonations = donationRequests.length;
            const totalUnits = donationRequests.reduce((sum, r) => sum + (r.bloodUnitsCount || 0), 0);
            const uniqueHospitals = new Set(donationRequests.map(r => r.hospitalId).filter(Boolean)).size;
            const requestIds = donationRequests.map(r => r.requestId).filter(Boolean);
            let eligibleReports = 0;
            if (requestIds.length > 0) {
                const histories = await DonationHistory.find({ requestId: { $in: requestIds } });
                const reportIds = histories.map(h => h.reportId).filter(Boolean);
                if (reportIds.length > 0) {
                    eligibleReports = await MedicalReport.countDocuments({ reportId: { $in: reportIds }, isEligible: true });
                }
            }
            return res.status(200).json({ records: donationRequests, summary: { totalDonations, totalUnits, uniqueHospitals, eligibleReports } });
        }

        return res.status(200).json(donationRequests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get donation request by ID
exports.getDonationRequestById = async (req, res) => {
    try {
        const donationRequest = await DonationRequest.findById(req.params.id);
        if (!donationRequest) {
            return res.status(404).json({ message: "Donation request not found" });
        }
        res.status(200).json(donationRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create new donation request
exports.createDonationRequest = async (req, res) => {
    try {
            // set status and approved properly
            const initialStatus = req.body.status ? String(req.body.status).toUpperCase() : 'PENDING';

            // If hospitalId provided, fetch hospital and snapshot key details
            const payload = { ...req.body };
            if (payload.hospitalId) {
                try {
                    const hosp = await Hospital.findById(payload.hospitalId).lean();
                    if (hosp) {
                        payload.hospitalName = hosp.hospitalName;
                        payload.hospitalAddress = hosp.address;
                        payload.hospitalPhone = hosp.phoneNumber;
                        payload.hospitalLocation = hosp.location;
                        if (hosp.locationGeo) payload.hospitalLocationGeo = hosp.locationGeo;
                    }
                } catch (e) {
                    // ignore hospital lookup failures — proceed with request creation
                    console.warn('Failed to lookup hospital for donation request', e.message || e);
                }
            }

            const donationRequest = new DonationRequest({
                ...payload,
                requestDate: new Date(),
                status: initialStatus,
                approved: initialStatus === 'APPROVED',
                availableDonors: 0 // Initialize with 0 available donors
            });

        const newDonationRequest = await donationRequest.save();
        res.status(201).json(newDonationRequest);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update donation request
exports.updateDonationRequest = async (req, res) => {
    try {
        // Load existing request to make safe decisions about approved/close behavior
        const existingRequest = await DonationRequest.findById(req.params.id);
        if (!existingRequest) {
            return res.status(404).json({ message: "Donation request not found" });
        }

        // Prepare updates from body but normalize status and avoid unintentionally flipping `approved`
        const updates = { ...req.body };
        if (updates.status) {
            updates.status = String(updates.status).toUpperCase();
            // Only set approved when explicitly approving
            if (updates.status === 'APPROVED') {
                updates.approved = true;
            } else {
                // preserve existing approved value when status is changing to non-APPROVED values
                updates.approved = existingRequest.approved;
            }
        } else {
            // If status not provided, ensure approved isn't accidentally changed by payload
            if (typeof updates.approved !== 'undefined') {
                // allow explicit approved changes (no-op here), or you can restrict this
            }
        }

        // Prevent closing/completing a request that was not previously approved
        if (updates.status === 'CLOSED' || updates.status === 'COMPLETED') {
            if (!existingRequest.approved) {
                return res.status(400).json({ message: 'Only approved requests can be closed or marked completed' });
            }
        }

        // If being marked as completed/closed, set timestamps if not provided
        if (updates.status === 'COMPLETED') {
            if (updates.fulfilledBy && !updates.fulfilledAt) {
                updates.fulfilledAt = new Date();
            }
        }
        if (updates.status === 'CLOSED') {
            if (!updates.closedAt) updates.closedAt = new Date();
        }

        const updatedRequest = await DonationRequest.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        );

        if (!updatedRequest) {
            return res.status(404).json({ message: "Donation request not found" });
        }

        res.json(updatedRequest);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete donation request
exports.deleteDonationRequest = async (req, res) => {
    try {
        const deletedRequest = await DonationRequest.findByIdAndDelete(req.params.id);
        
        if (!deletedRequest) {
            return res.status(404).json({ message: "Donation request not found" });
        }
        
        res.json({ message: "Donation request deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// Volunteer for a donation request
exports.volunteerForDonation = async (req, res) => {
    try {
        const { donorId, donorName, contact, expectedDonationTime, message } = req.body;
        const donationRequest = await DonationRequest.findById(req.params.requestId);
        
        if (!donationRequest) {
            return res.status(404).json({ message: "Donation request not found" });
        }

        // Only allow volunteering for approved requests
        if (!donationRequest.approved && String(donationRequest.status).toUpperCase() !== 'APPROVED') {
            return res.status(400).json({ message: "Donation request is not approved for volunteers" });
        }

        // Append volunteer details
        const volunteerEntry = {
            donorId: donorId || null,
            donorName: donorName || null,
            contact: contact || null,
            expectedDonationTime: expectedDonationTime ? new Date(expectedDonationTime) : null,
            message: message || null,
            volunteeredAt: new Date()
        };

        donationRequest.volunteers = donationRequest.volunteers || [];
        donationRequest.volunteers.push(volunteerEntry);

        // increment available donors and mark as in-progress; do NOT auto-mark as fulfilled
        // Admin must explicitly close/complete the request.
        donationRequest.availableDonors = (donationRequest.availableDonors || 0) + 1;
        donationRequest.status = 'IN_PROGRESS';

        await donationRequest.save();

        res.status(200).json({ 
            message: "Successfully volunteered for donation",
            donationRequest
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};