const DonationRequest = require("../models/DonationRequest");
const DonationHistory = require("../models/DonationHistory");
const MedicalReport = require("../models/MedicalReport");
const Hospital = require("../models/Hospital");

// Get all donation requests
exports.getAllDonationRequests = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        
        if (status) {
            // Allow passing status in either UPPER or lower case
            query.status = typeof status === 'string' ? status.toUpperCase() : status;
        }

        // If request made by a non-admin user, restrict to donation requests
        // where the user is listed as a volunteer (volunteers.donorId)
        const user = req.user || {};
        const isAdmin = typeof user.roleId !== 'undefined' && String(user.roleId) === '0';
        if (!isAdmin && query.status === 'COMPLETED') {
           
            // support tokens that include either `userIds` (array) or `userId` (single)
            if (Array.isArray(user.userIds) && user.userIds.length > 0) {
                query['volunteers.donorId'] = { $in: user.userIds.map(id => String(id)) };
            } else if (user.userId) {
                query['volunteers.donorId'] = String(user.userId);
            } else {
                return res.status(403).json({ message: 'User context missing or insufficient privileges' });
            }
        }
        console.log(query,"======");
        const donationRequests = await DonationRequest.find(query);

        // If requesting closed donation requests, include summary statistics
        if (query.status === 'COMPLETED') {
            const totalDonations = donationRequests.length;
            const totalUnits = donationRequests.reduce((sum, r) => sum + (r.bloodUnitsCount || 0), 0);
            const uniqueHospitals = new Set(donationRequests.map(r => r.hospitalId).filter(Boolean)).size;

            // Find related donationHistory entries by matching requestId (if present on requests)
            const requestIds = donationRequests.map(r => r.requestId).filter(Boolean);
            let eligibleReports = 0;
            if (requestIds.length > 0) {
                // Get donation history entries that reference these requestIds
                const histories = await DonationHistory.find({ requestId: { $in: requestIds } });
                const reportIds = histories.map(h => h.reportId).filter(Boolean);
                if (reportIds.length > 0) {
                    // Count medical reports that are marked eligible
                    eligibleReports = await MedicalReport.countDocuments({ reportId: { $in: reportIds }, isEligible: true });
                }
            }

            return res.status(200).json({
                records: donationRequests,
                summary: {
                    totalDonations,
                    totalUnits,
                    uniqueHospitals,
                    eligibleReports
                }
            });
        }

        res.status(200).json(donationRequests);
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

        // Prepare body and, if hospitalId provided, snapshot hospital details
        const body = { ...req.body };
        if (body.hospitalId) {
            let hospital = null;
            try {
                hospital = await Hospital.findById(body.hospitalId);
            } catch (e) {
                hospital = null;
            }
            if (!hospital) {
                hospital = await Hospital.findOne({ hospitalId: String(body.hospitalId) });
            }
            if (hospital) {
                body.hospitalId = hospital._id ? String(hospital._id) : body.hospitalId;
                body.hospitalName = hospital.hospitalName || body.hospitalName;
                body.hospitalAddress = hospital.address || body.hospitalAddress;
                body.hospitalPhone = hospital.phoneNumber || body.hospitalPhone;
                if (hospital.hospitalLocationGeo && hospital.hospitalLocationGeo.type === 'Point' && Array.isArray(hospital.hospitalLocationGeo.coordinates) && hospital.hospitalLocationGeo.coordinates.length === 2) {
                    body.hospitalLocationGeo = hospital.hospitalLocationGeo;
                } else {
                    delete body.hospitalLocationGeo;
                }
            }
        } else {
            // sanitize hospitalLocationGeo if provided to avoid invalid GeoJSON
            if (body.hospitalLocationGeo && body.hospitalLocationGeo.type === 'Point') {
                if (!Array.isArray(body.hospitalLocationGeo.coordinates) || body.hospitalLocationGeo.coordinates.length !== 2) {
                    // remove invalid geo to prevent MongoDB errors
                    delete body.hospitalLocationGeo;
                }
            }
        }

        const donationRequest = new DonationRequest({
            ...body,
            requestDate: new Date(),
            status: initialStatus,
            approved: initialStatus === 'APPROVED',
        });

        await donationRequest.save();

        res.status(201).json(donationRequest);
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

        // sanitize hospitalLocationGeo if present to avoid invalid GeoJSON
        if (updates.hospitalLocationGeo && updates.hospitalLocationGeo.type === 'Point') {
            if (!Array.isArray(updates.hospitalLocationGeo.coordinates) || updates.hospitalLocationGeo.coordinates.length !== 2) {
                delete updates.hospitalLocationGeo;
            }
        }

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
            // If frontend provided an array of fulfillers, persist them and set fallback single fields
            if (Array.isArray(updates.fulfilledByList) && updates.fulfilledByList.length > 0) {
                // ensure string fallbacks for existing code paths
                updates.fulfilledBy = updates.fulfilledBy || String(updates.fulfilledByList[0]);
                if (Array.isArray(updates.fulfilledByNames) && updates.fulfilledByNames.length > 0) {
                    updates.fulfilledByName = updates.fulfilledByName || String(updates.fulfilledByNames[0]);
                }
                // set fulfilledAt if not present
                if (!updates.fulfilledAt) updates.fulfilledAt = new Date();
            } else if (updates.fulfilledBy && !updates.fulfilledAt) {
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

        // sanitize stored geo field if invalid (some older documents may contain only { type: 'Point' })
        if (donationRequest.hospitalLocationGeo && donationRequest.hospitalLocationGeo.type === 'Point') {
            if (!Array.isArray(donationRequest.hospitalLocationGeo.coordinates) || donationRequest.hospitalLocationGeo.coordinates.length !== 2) {
                // remove invalid geo field to avoid MongoDB GeoJSON errors on save
                donationRequest.hospitalLocationGeo = undefined;
                delete donationRequest.hospitalLocationGeo;
            }
        }

        await donationRequest.save();

        res.status(200).json({ 
            message: "Successfully volunteered for donation",
            donationRequest
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};