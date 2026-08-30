const Donor = require("../models/Donor");
const eligibility = require("../utils/eligibility");
const { normalize } = require("../utils/bloodCompatibility");
const DonationHistory = require("../models/DonationHistory");

// Create Donor Functionality 

const CryptoJs = require('crypto-js');
const Roles = require('../models/Roles');
const User = require('../models/User');

// Create Donor Functionality
const createDonor = async (req, res) => {
    try {
        // If request is made by admin (via donor management), create both User and Donor
        const isAdmin = req.user && Number(req.user.roleId) === 0;

        // Basic required fields validation
        if (!req.body.email || !req.body.phoneNumber || !req.body.firstName || !req.body.lastName) {
            return res.status(400).json({ message: 'Missing required fields: firstName, lastName, email, phoneNumber' });
        }

        // Check duplicates in User collection
        const existingEmail = await User.findOne({ email: req.body.email }).lean();
        const existingPhone = await User.findOne({ phoneNumber: req.body.phoneNumber }).lean();
        if (existingEmail || existingPhone) {
            const fields = {};
            if (existingEmail) fields.email = true;
            if (existingPhone) fields.phoneNumber = true;
            return res.status(409).json({ code: 'DUPLICATE', msg: 'Email or phone number already exists', fields });
        }

        // Determine roleId for donor role
        const donorRole = await Roles.findOne({ userRole: 'donor' });
        const donorRoleId = donorRole ? donorRole.roleId : 1;

        let createdUser = null;
        let passwordPlain = null;
        // Create user record for donor when admin creates donor
        if (isAdmin) {
            passwordPlain = req.body.password || Math.random().toString(36).slice(-8);
            const newUser = new User({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                email: req.body.email,
                password: CryptoJs.AES.encrypt(passwordPlain, process.env.PASS).toString(),
                phoneNumber: req.body.phoneNumber,
                bloodGroup: req.body.bloodGroup || '',
                dateofBirth: req.body.dateofBirth || undefined,
                address: req.body.address || undefined,
                height: req.body.height || undefined,
                weight: req.body.weight || undefined,
                roleId: donorRoleId,
                isActive: 1
            });
            createdUser = await newUser.save();

            // Create a UserProfile for the created user if profile data provided
            try {
                const profilePayload = {};
                if (req.body.address) profilePayload.address = req.body.address;
                if (req.body.city) profilePayload.city = req.body.city;
                if (req.body.state) profilePayload.state = req.body.state;
                if (req.body.country) profilePayload.country = req.body.country;
                if (req.body.pincode) profilePayload.pincode = req.body.pincode;
                if (req.body.latitude && req.body.longitude) {
                    const lat = parseFloat(req.body.latitude);
                    const lng = parseFloat(req.body.longitude);
                    if (!Number.isNaN(lat) && !Number.isNaN(lng)) profilePayload.locationGeo = { type: 'Point', coordinates: [lng, lat] };
                } else if (req.body.locationGeo && req.body.locationGeo.type === 'Point' && Array.isArray(req.body.locationGeo.coordinates) && req.body.locationGeo.coordinates.length === 2) {
                    profilePayload.locationGeo = req.body.locationGeo;
                }
                if (Object.keys(profilePayload).length > 0) {
                    const UserProfile = require('../models/UserProfile');
                    await new UserProfile({ userId: createdUser._id, ...profilePayload }).save();
                }
            } catch (e) {
                console.warn('Failed to create user profile for created donor user', e && e.message ? e.message : e);
            }
        }

        // Build donor document
        const age = req.body.dateofBirth ? Math.abs(new Date().getUTCFullYear() - new Date(req.body.dateofBirth).getUTCFullYear()) : (req.body.age || 0);
        const donorData = {
            userId: createdUser ? createdUser._id : (req.body.userId || undefined),
            name: `${req.body.firstName} ${req.body.lastName}`.trim(),
            email: req.body.email,
            address: req.body.address || '',
            phoneNumber: req.body.phoneNumber,
            bloodGroup: req.body.bloodGroup || '',
            height: req.body.height ? String(req.body.height) : '',
            weight: req.body.weight ? String(req.body.weight) : '',
            date: new Date().toISOString(),
            dateofBirth: req.body.dateofBirth || null,
            age: age || 0,
            bloodPressure: req.body.bloodPressure || 0,
            diseases: req.body.diseases || 'No',
            status: req.body.status || 0
        };

        const newDonor = new Donor(donorData);
        const donor = await newDonor.save();

        // Return created user credentials to admin (password only if generated here)
        const result = { donor };
        if (createdUser) {
            result.user = { _id: createdUser._id, email: createdUser.email };
            // include plain password (generated or provided) so admin can share it securely
            result.plainPassword = passwordPlain || null;
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error('createDonor error', error);
        return res.status(500).json({ error: error.message });
    }
}

//Get all Donors 

// GET /api/v1/donors
//
// Rewritten to use utils/eligibility. Three defects are fixed here:
//  * Donation history was looked up with `userId: donor._id` — the Donor document's own
//    id — but DonationHistory.userId holds the *User* id. The query never matched, so
//    every donor reported zero donations and unconditional eligibility.
//  * The waiting period was hard-coded to 180 days here and 30 days in the notification
//    controller; the synopsis specifies three months. Both now read the same constant.
//  * The eligibility filter compared against a field the mapping function never set, so
//    it silently filtered on the stored flag instead of the computed status.
//  * History was fetched one donor at a time (N+1); it is now a single aggregate.
const getAlldonors = async (req, res, next) => {
    try {
        let { page = 1, size = 10, sortField, sortOrder, search, bloodType, eligibility: eligibilityFilter } = req.query;
        page = Math.max(1, parseInt(page, 10) || 1);
        size = Math.min(100, Math.max(1, parseInt(size, 10) || 10));

        const mongoQuery = {};
        if (search) {
            // Escape regex metacharacters so a search term cannot alter the query.
            const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(safe, 'i');
            mongoQuery.$or = [{ name: re }, { email: re }, { phoneNumber: re }];
        }
        if (bloodType && bloodType !== 'all') {
            const group = normalize(bloodType);
            if (!group) return res.status(400).json({ msg: `Unrecognised blood group: ${bloodType}` });
            mongoQuery.bloodGroup = group;
        }

        let sortObj = { createdAt: -1 };
        if (sortField && ['name', 'bloodGroup', 'createdAt'].includes(sortField)) {
            sortObj = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
        }

        // Decorate a page of donors with their donation statistics and computed eligibility.
        const decorate = async (donors) => {
            const userIds = donors.map(d => String(d.userId || d._id));
            const [lastDates, stats] = await Promise.all([
                eligibility.latestDonationDates(userIds),
                DonationHistory.aggregate([
                    { $match: { userId: { $in: userIds } } },
                    { $sort: { donationDate: -1 } },
                    { $group: {
                        _id: '$userId',
                        totalDonations: { $sum: { $cond: [{ $in: ['$status', eligibility.SUCCESSFUL_STATUSES] }, 1, 0] } },
                        lastDonationDate: { $first: '$donationDate' },
                        lastStatus: { $first: '$status' }
                    } }
                ])
            ]);
            const statsByUser = new Map(stats.map(s => [String(s._id), s]));

            return donors.map(donor => {
                const key = String(donor.userId || donor._id);
                const stat = statsByUser.get(key) || {};
                const verdict = eligibility.evaluateDonor(donor, lastDates.get(key) || null);
                return {
                    ...donor,
                    totalDonations: stat.totalDonations || 0,
                    lastDonationDate: stat.lastDonationDate || null,
                    lastStatus: stat.lastStatus || null,
                    eligibility: verdict.status,
                    eligibilityReasons: verdict.reasons,
                    nextEligibleDate: verdict.nextEligibleDate,
                    daysUntilEligible: verdict.daysUntilEligible
                };
            });
        };

        // Eligibility is computed rather than stored, so filtering by it means evaluating
        // the whole matching set before paginating.
        if (eligibilityFilter === 'eligible' || eligibilityFilter === 'ineligible') {
            const all = await decorate(await Donor.find(mongoQuery).sort(sortObj).lean());
            const filtered = all.filter(d => d.eligibility === eligibilityFilter);
            const start = (page - 1) * size;
            return res.status(200).json({
                donors: filtered.slice(start, start + size),
                total: filtered.length,
                page,
                size,
                totalPages: Math.ceil(filtered.length / size) || 1
            });
        }

        const total = await Donor.countDocuments(mongoQuery);
        const donors = await Donor.find(mongoQuery).sort(sortObj)
            .skip((page - 1) * size).limit(size).lean();

        res.status(200).json({
            donors: await decorate(donors),
            total,
            page,
            size,
            totalPages: Math.ceil(total / size) || 1
        });
    } catch (error) { next(error); }
}

//Update Donor 


const updateDonor = async (req, res) => {
    try {
        const donorId = req.params.id;
        const donor = await Donor.findById(donorId);
        if (!donor) return res.status(404).json({ message: 'Donor not found' });

        // If admin is changing email/phone, ensure no duplicate in users collection (excluding linked user)
        if (req.body.email || req.body.phoneNumber) {
            const or = [];
            if (req.body.email) or.push({ email: req.body.email });
            if (req.body.phoneNumber) or.push({ phoneNumber: req.body.phoneNumber });
            if (or.length) {
                const conflictUser = await User.findOne({ $or: or, _id: { $ne: donor.userId } }).lean();
                if (conflictUser) {
                    const fields = {};
                    if (req.body.email && conflictUser.email === req.body.email) fields.email = true;
                    if (req.body.phoneNumber && conflictUser.phoneNumber === req.body.phoneNumber) fields.phoneNumber = true;
                    return res.status(409).json({ code: 'DUPLICATE', msg: 'Email or phone number already exists', fields });
                }
            }
        }

        // Prepare donor update
        const donorUpdate = { ...req.body };
        // If name provided, do not split yet; will handle user sync
        const updatedDonor = await Donor.findByIdAndUpdate(
            donorId,
            { $set: donorUpdate },
            { new: true }
        );

        // Sync back to user if linked
        if (donor.userId) {
            const userUpdate = {};
            if (req.body.name) {
                const parts = String(req.body.name).trim().split(' ');
                userUpdate.firstName = parts[0];
                userUpdate.lastName = parts.slice(1).join(' ') || '';
            }
            ['email', 'address', 'phoneNumber', 'bloodGroup', 'height', 'weight', 'dateofBirth'].forEach(f => {
                if (req.body[f] !== undefined) userUpdate[f] = req.body[f];
            });
            if (req.body.dateofBirth) {
                userUpdate.dateofBirth = req.body.dateofBirth;
            }
            if (Object.keys(userUpdate).length > 0) {
                await User.findByIdAndUpdate(donor.userId, { $set: userUpdate });
            }
        }

        res.status(201).json(updatedDonor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//GET One Donor 

const getOneDonor = async (req, res) => {
    try {
        const donor = await Donor.findById(req.params.id);
        if (!donor) {
            return res.status(404).json({ message: "Donor not found" });
        }
        res.status(200).json(donor)
    } catch (error) {
        res.status(500).json(error)
    }
}

//Delete Donor 

const deleteDonor = async (req, res) => {
    try {
        const donor = await Donor.findById(req.params.id);
        if (!donor) {
            return res.status(404).json({ message: "Donor not found" });
        }

        // If linked to a User, delete the User as well so donor cannot login
        if (donor.userId) {
            try {
                await User.findByIdAndDelete(donor.userId);
            } catch (e) {
                console.warn('Failed to delete linked user for donor', e && e.message ? e.message : e);
            }
        }

        // Delete donor record
        await Donor.findByIdAndDelete(req.params.id);

        // Note: donation history and other related records are intentionally preserved
        res.status(200).json({ "message": "Deleted Donor and linked user successfully", donorId: req.params.id });
    } catch (error) {
        res.status(500).json(error)
    }
}

//Stats 
// GET /api/v1/donors/stats
// Eligibility counts for the Admin Dashboard, computed with the shared rules and two
// aggregates rather than a query per donor.
const getDonorsStats = async (req, res, next) => {
    try {
        const donors = await Donor.find().lean();
        const evaluated = await eligibility.evaluateDonors(donors);

        const eligibleDonors = evaluated.filter(e => e.eligible).length;

        // Why the ineligible donors are blocked, so the dashboard can show the breakdown.
        const blockedBy = { waitingPeriod: 0, medical: 0, ageOrWeight: 0 };
        evaluated.filter(e => !e.eligible).forEach(e => {
            if (e.daysUntilEligible > 0) blockedBy.waitingPeriod++;
            else if (e.reasons.some(r => /medical|condition/i.test(r))) blockedBy.medical++;
            else blockedBy.ageOrWeight++;
        });

        const byBloodGroup = donors.reduce((acc, d) => {
            const group = normalize(d.bloodGroup) || 'unknown';
            acc[group] = (acc[group] || 0) + 1;
            return acc;
        }, {});

        const totalSuccessDonations = await DonationHistory.countDocuments({
            status: { $in: eligibility.SUCCESSFUL_STATUSES }
        });

        res.status(200).json({
            totalDonors: donors.length,
            eligibleDonors,
            ineligibleDonors: donors.length - eligibleDonors,
            blockedBy,
            byBloodGroup,
            totalSuccessDonations,
            waitingPeriodDays: eligibility.MIN_DAYS_BETWEEN_DONATIONS
        });
    } catch (error) { next(error); }
}

module.exports = { deleteDonor, getOneDonor, getAlldonors, getDonorsStats, updateDonor, createDonor }
// GET /api/v1/donors/eligibility/:userId
// Full eligibility verdict for one donor, including why they are blocked and when they
// become eligible again. Donors may read their own; administrators may read anyone's.
const getDonorEligibility = async (req, res, next) => {
    try {
        const userId = req.params.userId === 'me' ? String(req.user.userId) : String(req.params.userId);
        const isAdmin = String((req.user || {}).roleId) === '0';
        if (!isAdmin && userId !== String(req.user.userId)) {
            return res.status(403).json({ msg: 'You may only view your own eligibility' });
        }

        const donor = await Donor.findOne({ userId }).lean();
        if (!donor) return res.status(404).json({ msg: 'No donor record found for this user' });

        const lastDates = await eligibility.latestDonationDates([userId]);
        const verdict = eligibility.evaluateDonor(donor, lastDates.get(userId) || null);
        const totalDonations = await DonationHistory.countDocuments({
            userId, status: { $in: eligibility.SUCCESSFUL_STATUSES }
        });

        res.status(200).json({
            userId,
            bloodGroup: donor.bloodGroup,
            totalDonations,
            waitingPeriodDays: eligibility.MIN_DAYS_BETWEEN_DONATIONS,
            ...verdict
        });
    } catch (error) { next(error); }
};

module.exports.getDonorEligibility = getDonorEligibility;
