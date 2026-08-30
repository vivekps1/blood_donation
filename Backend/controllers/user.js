// User Management module (admin side).
//
// Synopsis section 9.b.4: administrators "review new registrations" through a centralised
// interface; section 10: "The administrator holds the authority to create different logins
// for different users, with regular users not permitted to create other user accounts."
//
// None of this existed — the /api/v1/users route was commented out in app.js, there was no
// user controller, and the `isActive` account-status field was written at registration but
// never read by anything.

const mongoose = require('mongoose');
const User = require('../models/User');
const Roles = require('../models/Roles');
const Donor = require('../models/Donor');
const UserProfile = require('../models/UserProfile');
const DonationHistory = require('../models/DonationHistory');
const password = require('../utils/password');
const notify = require('../utils/notify');

// Never return credential material or single-use tokens to a client.
const PUBLIC_FIELDS = '-password -verificationCodeHash -verificationExpires -passwordResetTokenHash -passwordResetExpires';

const decorateWithRole = async (users) => {
    const roles = await Roles.find().lean();
    const roleMap = new Map(roles.map(r => [Number(r.roleId), r]));
    return users.map(u => ({
        ...u,
        userRole: (roleMap.get(Number(u.roleId)) || {}).userRole || 'unknown'
    }));
};

// GET /api/v1/users
exports.getUsers = async (req, res, next) => {
    try {
        const { search, role, status, verified, page = 1, size = 10, sortField = 'createdAt', sortOrder = 'desc' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(size, 10) || 10));

        const filter = {};

        if (search) {
            // Escape regex metacharacters so a search for "a+b" cannot throw or scan oddly.
            const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(safe, 'i');
            filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { phoneNumber: re }];
        }
        if (role && role !== 'all') {
            const roleDoc = await Roles.findOne({ userRole: role }).lean();
            // An unknown role name must match nothing rather than everything.
            filter.roleId = roleDoc ? roleDoc.roleId : -1;
        }
        if (status && status !== 'all') filter.isActive = status === 'active';
        if (verified && verified !== 'all') filter.isVerified = verified === 'true';

        const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

        const [total, users] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter).select(PUBLIC_FIELDS).sort(sort)
                .skip((pageNum - 1) * pageSize).limit(pageSize).lean()
        ]);

        // Donation counts for the whole page in one aggregate rather than per row.
        const ids = users.map(u => String(u._id));
        const counts = await DonationHistory.aggregate([
            { $match: { userId: { $in: ids }, status: { $in: ['Success', 'Completed'] } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]);
        const countMap = new Map(counts.map(c => [String(c._id), c.count]));

        const withRoles = await decorateWithRole(users);

        res.status(200).json({
            count: total,
            page: pageNum,
            size: pageSize,
            totalPages: Math.ceil(total / pageSize),
            users: withRoles.map(u => ({ ...u, totalDonations: countMap.get(String(u._id)) || 0 }))
        });
    } catch (err) { next(err); }
};

// GET /api/v1/users/pending — registrations an administrator has not yet reviewed.
exports.getPendingUsers = async (req, res, next) => {
    try {
        const users = await User.find({ $or: [{ isVerified: false }, { isActive: false }] })
            .select(PUBLIC_FIELDS).sort({ createdAt: -1 }).limit(100).lean();
        res.status(200).json({ count: users.length, users: await decorateWithRole(users) });
    } catch (err) { next(err); }
};

// GET /api/v1/users/:id
exports.getUserById = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }
        const user = await User.findById(req.params.id).select(PUBLIC_FIELDS).lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const [role, profile, donor, donationCount] = await Promise.all([
            Roles.findOne({ roleId: user.roleId }).lean(),
            UserProfile.findOne({ userId: user._id }).lean(),
            Donor.findOne({ userId: user._id }).lean(),
            DonationHistory.countDocuments({ userId: String(user._id), status: { $in: ['Success', 'Completed'] } })
        ]);

        res.status(200).json({
            ...user,
            userRole: role ? role.userRole : 'unknown',
            permissions: role || null,
            profile: profile || null,
            donor: donor || null,
            totalDonations: donationCount
        });
    } catch (err) { next(err); }
};

// POST /api/v1/users — administrator creates a login for someone else.
exports.createUser = async (req, res, next) => {
    try {
        const { firstName, lastName, email, phoneNumber, bloodGroup, roleId = 1,
                dateofBirth, address, hospitalId } = req.body;

        const rawPassword = req.body.password;
        const strength = password.validatePasswordStrength(rawPassword);
        if (!strength.valid) return res.status(400).json({ message: 'Weak password', errors: strength.errors });

        const roleDoc = await Roles.findOne({ roleId: Number(roleId) });
        if (!roleDoc) return res.status(400).json({ message: `No role exists with roleId ${roleId}` });

        const clash = await User.findOne({ $or: [{ email: String(email).toLowerCase() }, { phoneNumber }] }).lean();
        if (clash) {
            return res.status(409).json({
                code: 'DUPLICATE',
                message: clash.email === String(email).toLowerCase() ? 'email already exists' : 'phone number already exists'
            });
        }

        const user = await User.create({
            firstName, lastName,
            email: String(email).toLowerCase(),
            phoneNumber, bloodGroup, dateofBirth, address,
            password: await password.hashPassword(rawPassword),
            roleId: roleDoc.roleId,
            hospitalId: hospitalId || undefined,
            // An account an administrator created in person needs no self-verification.
            isVerified: true,
            isActive: true,
            referralCode: password.generateToken(6)
        });

        // Donors need the matching Donor record or they will never appear in a match.
        if (roleDoc.userRole === 'donor') {
            await Donor.create({
                userId: user._id,
                name: `${firstName} ${lastName || ''}`.trim(),
                email: user.email, phoneNumber, bloodGroup, address,
                date: new Date().toISOString(),
                dateofBirth: dateofBirth || null,
                age: dateofBirth ? Math.floor((Date.now() - new Date(dateofBirth).getTime()) / (365.25 * 24 * 3600 * 1000)) : 0,
                bloodPressure: 0,
                height: String(req.body.height ?? ''),
                weight: String(req.body.weight ?? '')
            });
        }

        const { password: _pw, ...safe } = user.toObject();
        res.status(201).json({ message: 'User created', user: { ...safe, userRole: roleDoc.userRole } });
    } catch (err) { next(err); }
};

// PUT /api/v1/users/:id
exports.updateUser = async (req, res, next) => {
    try {
        const updates = {};
        // Only these fields may be set through this endpoint. Role and status have their
        // own endpoints, and password has its own flow, so a stray field in the body
        // cannot escalate an account.
        ['firstName', 'lastName', 'phoneNumber', 'bloodGroup', 'dateofBirth', 'address',
         'height', 'weight', 'locationName', 'hospitalId'].forEach(f => {
            if (typeof req.body[f] !== 'undefined') updates[f] = req.body[f];
        });
        if (req.body.email) updates.email = String(req.body.email).toLowerCase();

        if (updates.email || updates.phoneNumber) {
            const clash = await User.findOne({
                _id: { $ne: req.params.id },
                $or: [
                    ...(updates.email ? [{ email: updates.email }] : []),
                    ...(updates.phoneNumber ? [{ phoneNumber: updates.phoneNumber }] : [])
                ]
            }).lean();
            if (clash) return res.status(409).json({ code: 'DUPLICATE', message: 'Email or phone number is already in use' });
        }

        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select(PUBLIC_FIELDS);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Keep the denormalised donor record in step with the user record.
        await Donor.updateOne({ userId: user._id }, {
            $set: {
                name: `${user.firstName} ${user.lastName || ''}`.trim(),
                email: user.email,
                phoneNumber: user.phoneNumber,
                bloodGroup: user.bloodGroup,
                address: user.address
            }
        });

        res.status(200).json({ message: 'User updated', user });
    } catch (err) { next(err); }
};

// PATCH /api/v1/users/:id/status — activate or deactivate an account.
exports.setUserStatus = async (req, res, next) => {
    try {
        const isActive = req.body.isActive === true || req.body.isActive === 'true';

        // An administrator must not be able to lock themselves out.
        if (String(req.params.id) === String(req.user.userId) && !isActive) {
            return res.status(400).json({ message: 'You cannot deactivate your own account' });
        }

        const user = await User.findByIdAndUpdate(req.params.id, { $set: { isActive } }, { new: true }).select(PUBLIC_FIELDS);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await notify.events.accountStatusChanged(user._id, isActive);
        res.status(200).json({ message: `Account ${isActive ? 'activated' : 'deactivated'}`, user });
    } catch (err) { next(err); }
};

// PATCH /api/v1/users/:id/role
exports.setUserRole = async (req, res, next) => {
    try {
        const roleDoc = await Roles.findOne({ roleId: Number(req.body.roleId) });
        if (!roleDoc) return res.status(400).json({ message: `No role exists with roleId ${req.body.roleId}` });

        // Guard against removing the last administrator.
        if (String(req.params.id) === String(req.user.userId) && roleDoc.userRole !== 'admin') {
            return res.status(400).json({ message: 'You cannot remove your own administrator role' });
        }

        const user = await User.findByIdAndUpdate(req.params.id, { $set: { roleId: roleDoc.roleId } }, { new: true }).select(PUBLIC_FIELDS);
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.status(200).json({ message: `Role changed to ${roleDoc.userRole}`, user: { ...user.toObject(), userRole: roleDoc.userRole } });
    } catch (err) { next(err); }
};

// DELETE /api/v1/users/:id
exports.deleteUser = async (req, res, next) => {
    try {
        if (String(req.params.id) === String(req.user.userId)) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Remove the records that exist only to support this account. Donation history and
        // medical reports are deliberately retained: they are clinical records, and the
        // synopsis treats data integrity of donation records as a core requirement.
        await Promise.all([
            Donor.deleteOne({ userId: user._id }),
            UserProfile.deleteOne({ userId: user._id })
        ]);

        res.status(200).json({ message: 'User deleted', userId: String(user._id) });
    } catch (err) { next(err); }
};

// GET /api/v1/users/me — the signed-in user's own record.
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId).select(PUBLIC_FIELDS).lean();
        if (!user) return res.status(404).json({ message: 'Account not found' });
        const [role, profile] = await Promise.all([
            Roles.findOne({ roleId: user.roleId }).lean(),
            UserProfile.findOne({ userId: user._id }).lean()
        ]);
        res.status(200).json({ ...user, userRole: role ? role.userRole : 'unknown', permissions: role || null, profile: profile || null });
    } catch (err) { next(err); }
};

// PUT /api/v1/users/me/preferences — notification channel preferences.
exports.updatePreferences = async (req, res, next) => {
    try {
        const prefs = {};
        ['email', 'sms', 'app'].forEach(channel => {
            if (typeof req.body[channel] !== 'undefined') {
                prefs[`notificationPreferences.${channel}`] = req.body[channel] === true || req.body[channel] === 'true';
            }
        });
        if (!Object.keys(prefs).length) {
            return res.status(400).json({ message: 'Provide at least one of: email, sms, app' });
        }
        const user = await User.findByIdAndUpdate(req.user.userId, { $set: prefs }, { new: true }).select(PUBLIC_FIELDS);
        if (!user) return res.status(404).json({ message: 'Account not found' });
        res.status(200).json({ message: 'Preferences updated', notificationPreferences: user.notificationPreferences });
    } catch (err) { next(err); }
};
