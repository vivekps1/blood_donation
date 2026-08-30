// Notification and Communication module.
//
// The broadcast endpoint here is the administrator's manual channel. Automatic,
// event-driven notifications live in utils/notify.js and are raised by the controllers
// that own each event; this controller now delegates all delivery to that same service so
// there is one implementation of "create a notification and send it".
//
// Two defects in the previous version are fixed:
//  * The hospital-targeted branch referenced `donorUsers`, a variable declared only in
//    the other branch, so any "eligible donors near hospital X" broadcast threw a
//    ReferenceError before sending anything.
//  * The 'donors' and hospital branches loaded every Donor in the database and ignored
//    the blood-group and geospatial filters that had just been computed.

const Notification = require('../models/Notification');
const User = require('../models/User');
const Roles = require('../models/Roles');
const Donor = require('../models/Donor');
const Hospital = require('../models/Hospital');
const notify = require('../utils/notify');
const eligibility = require('../utils/eligibility');
const matching = require('../utils/matching');
const { normalize, compatibleDonorGroups } = require('../utils/bloodCompatibility');

// Resolve the audience for a broadcast into a list of User documents.
//
// audience: 'all' | 'donors' | 'eligible' | a specific user id
// Optional narrowing: bloodType, hospitalId (with radiusKm), compatibleWith.
const resolveAudience = async ({ audience = 'all', bloodType, hospitalId, radiusKm = 30, compatibleWith }) => {
    // A single named recipient.
    if (audience && !['all', 'donors', 'eligible'].includes(audience)) {
        const user = await User.findById(audience).catch(() => null);
        return { users: user ? [user] : [], describe: user ? `1 named recipient` : 'no matching recipient' };
    }

    if (audience === 'all') {
        const users = await User.find({ isActive: { $ne: false } });
        return { users, describe: `${users.length} active user(s)` };
    }

    // Donor audiences start from the Donor collection so blood group is authoritative.
    const donorFilter = {};
    if (bloodType && bloodType !== 'all') {
        const group = normalize(bloodType);
        if (!group) throw Object.assign(new Error(`Unrecognised blood group: ${bloodType}`), { status: 400 });
        donorFilter.bloodGroup = group;
    } else if (compatibleWith) {
        // Everyone who could donate to a patient of this group.
        const groups = compatibleDonorGroups(compatibleWith);
        if (!groups.length) throw Object.assign(new Error(`Unrecognised blood group: ${compatibleWith}`), { status: 400 });
        donorFilter.bloodGroup = { $in: groups };
    }

    const donors = await Donor.find(donorFilter).lean();
    const userIds = donors.map(d => String(d.userId)).filter(Boolean);
    if (!userIds.length) return { users: [], describe: 'no donors matched the blood group filter' };

    let users = await User.find({ _id: { $in: userIds }, isActive: { $ne: false } });

    // Geographic narrowing around a hospital.
    if (hospitalId) {
        const hospital = await Hospital.findById(hospitalId).lean();
        if (!hospital) throw Object.assign(new Error('Hospital not found'), { status: 404 });

        const origin = matching.coordsOf(hospital.hospitalLocationGeo) || matching.coordsOf(hospital.locationGeo);
        if (!origin) throw Object.assign(new Error('That hospital has no saved location, so donors cannot be selected by proximity'), { status: 400 });

        const UserProfile = require('../models/UserProfile');
        const profiles = await UserProfile.find({ userId: { $in: users.map(u => u._id) } }).lean();
        const coordsByUser = new Map(profiles.map(p => [String(p.userId), matching.coordsOf(p.locationGeo)]));

        users = users.filter(u => {
            const coords = coordsByUser.get(String(u._id)) || matching.coordsOf(u.locationGeo);
            if (!coords) return false; // no known location means we cannot claim proximity
            const distance = matching.haversineKm(origin, coords);
            return distance !== null && distance <= Number(radiusKm);
        });
    }

    // Eligibility narrowing — the 90-day gap and health status, from one aggregate.
    if (audience === 'eligible') {
        const donorByUser = new Map(donors.map(d => [String(d.userId), d]));
        const lastDates = await eligibility.latestDonationDates(users.map(u => String(u._id)));
        users = users.filter(u => {
            const donor = donorByUser.get(String(u._id));
            return eligibility.evaluateDonor(donor || {}, lastDates.get(String(u._id)) || null).eligible;
        });
    }

    const parts = [`${users.length} donor(s)`];
    if (donorFilter.bloodGroup) parts.push('filtered by blood group');
    if (hospitalId) parts.push(`within ${radiusKm}km of the hospital`);
    if (audience === 'eligible') parts.push('currently eligible to donate');
    return { users, describe: parts.join(', ') };
};

// POST /api/v1/notifications — administrator broadcast.
exports.createNotification = async (req, res, next) => {
    try {
        const { audience = 'all', bloodType, hospitalId, radiusKm, compatibleWith,
                title, message, channel, priority, requestId } = req.body;

        if (!message) return res.status(400).json({ message: 'A message is required' });

        const { users, describe } = await resolveAudience({
            audience: req.body.userId || audience,
            bloodType, hospitalId, radiusKm, compatibleWith
        });

        if (!users.length) {
            return res.status(200).json({ message: `No recipients found (${describe})`, createdCount: 0, audience: describe });
        }

        const result = await notify.notifyUsers(users, {
            category: 'ADMIN_BROADCAST',
            title: title || 'Message from the blood bank',
            message,
            channels: channel,
            priority,
            requestId,
            adminId: req.user && req.user.userId
        });

        res.status(201).json({
            message: 'Notifications dispatched',
            createdCount: result.createdCount,
            audience: describe,
            // Per-channel outcome, so the admin sees what actually went out.
            delivery: result.notifications.reduce((acc, n) => {
                ['email', 'sms'].forEach(ch => {
                    const status = n.delivery && n.delivery[ch] ? n.delivery[ch].status : 'skipped';
                    acc[ch] = acc[ch] || {};
                    acc[ch][status] = (acc[ch][status] || 0) + 1;
                });
                return acc;
            }, {})
        });
    } catch (error) { next(error); }
};

// POST /api/v1/notifications/audience-preview — how many people would this reach?
exports.previewAudience = async (req, res, next) => {
    try {
        const { users, describe } = await resolveAudience(req.body || {});
        res.status(200).json({
            count: users.length,
            describe,
            sample: users.slice(0, 10).map(u => ({
                id: String(u._id),
                name: `${u.firstName} ${u.lastName || ''}`.trim(),
                bloodGroup: u.bloodGroup
            }))
        });
    } catch (error) { next(error); }
};

// GET /api/v1/notifications
exports.getNotifications = async (req, res, next) => {
    try {
        const { userId, isRead, type, category, page = 1, size = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(size, 10) || 20));

        const filter = {};
        // A user may only read their own notifications; only an administrator may pass
        // an arbitrary userId. Previously any signed-in user could read anyone's inbox.
        const isAdmin = String((req.user || {}).roleId) === '0';
        filter.userId = isAdmin && userId ? String(userId) : String(req.user.userId);

        if (typeof isRead !== 'undefined' && isRead !== 'all') filter.isRead = (isRead === 'true' || isRead === '1');
        if (type && type !== 'all') filter.notificationType = type;
        if (category && category !== 'all') filter.category = category;

        const [total, unread, notifications] = await Promise.all([
            Notification.countDocuments(filter),
            Notification.countDocuments({ userId: filter.userId, isRead: false }),
            Notification.find(filter).sort({ sentAt: -1 })
                .skip((pageNum - 1) * pageSize).limit(pageSize).lean()
        ]);

        res.status(200).json({ count: total, unread, page: pageNum, size: pageSize, notifications });
    } catch (error) { next(error); }
};

// GET /api/v1/notifications/stats
// "It tracks notification delivery and engagement, offering administrators insights into
// communication effectiveness" — synopsis 9.b.5.
exports.getNotificationStats = async (req, res, next) => {
    try {
        const { dateFrom, dateTo } = req.query;
        const match = {};
        if (dateFrom || dateTo) {
            match.sentAt = {};
            if (dateFrom) match.sentAt.$gte = new Date(dateFrom);
            if (dateTo) match.sentAt.$lte = new Date(dateTo);
        }

        const [totals, byCategory, byEmail, bySms] = await Promise.all([
            Notification.aggregate([
                { $match: match },
                { $group: { _id: null, sent: { $sum: 1 }, read: { $sum: { $cond: ['$isRead', 1, 0] } } } }
            ]),
            Notification.aggregate([
                { $match: match },
                { $group: { _id: '$category', sent: { $sum: 1 }, read: { $sum: { $cond: ['$isRead', 1, 0] } } } },
                { $sort: { sent: -1 } }
            ]),
            Notification.aggregate([
                { $match: match },
                { $group: { _id: '$delivery.email.status', count: { $sum: 1 } } }
            ]),
            Notification.aggregate([
                { $match: match },
                { $group: { _id: '$delivery.sms.status', count: { $sum: 1 } } }
            ])
        ]);

        const total = totals[0] || { sent: 0, read: 0 };
        const asMap = (rows) => rows.reduce((acc, r) => { acc[r._id || 'unknown'] = r.count; return acc; }, {});

        res.status(200).json({
            sent: total.sent,
            read: total.read,
            unread: total.sent - total.read,
            // Engagement: what proportion of what we sent was actually opened.
            readRate: total.sent ? Math.round((total.read / total.sent) * 1000) / 10 : 0,
            byCategory: byCategory.map(c => ({
                category: c._id || 'uncategorised',
                sent: c.sent,
                read: c.read,
                readRate: c.sent ? Math.round((c.read / c.sent) * 1000) / 10 : 0
            })),
            delivery: { email: asMap(byEmail), sms: asMap(bySms) }
        });
    } catch (error) { next(error); }
};

// POST /api/v1/notifications/eligibility-sweep
// "generating personalized notifications when ... a user becomes eligible to donate"
// (synopsis 9.b.5). Finds donors whose waiting period has just elapsed and tells them.
// Intended to run on a daily schedule; also available on demand to administrators.
exports.runEligibilitySweep = async (req, res, next) => {
    try {
        const donorRole = await Roles.findOne({ userRole: 'donor' }).lean();
        const users = await User.find({
            roleId: donorRole ? donorRole.roleId : 1,
            isActive: { $ne: false }
        }).lean();

        const userIds = users.map(u => String(u._id));
        const [donors, lastDates] = await Promise.all([
            Donor.find({ userId: { $in: userIds } }).lean(),
            eligibility.latestDonationDates(userIds)
        ]);
        const donorByUser = new Map(donors.map(d => [String(d.userId), d]));

        // Only donors who have actually donated before and have just crossed the
        // threshold — a donor with no history was never blocked, so telling them they are
        // "eligible again" would be noise.
        const windowDays = Number(req.body && req.body.windowDays) || 7;
        const now = Date.now();
        const becameEligible = [];

        for (const user of users) {
            const id = String(user._id);
            const last = lastDates.get(id);
            if (!last) continue;

            const verdict = eligibility.evaluateDonor(donorByUser.get(id) || {}, last);
            if (!verdict.eligible) continue;

            // Crossed the line within the sweep window, so each donor is told once.
            const daysSinceEligible = (now - new Date(verdict.nextEligibleDate).getTime()) / (24 * 3600 * 1000);
            if (daysSinceEligible >= 0 && daysSinceEligible <= windowDays) becameEligible.push(id);
        }

        // Do not repeat an alert already sent to this donor in the current window.
        const since = new Date(now - windowDays * 24 * 3600 * 1000);
        const alreadyTold = await Notification.find({
            userId: { $in: becameEligible }, category: 'DONOR_ELIGIBLE', sentAt: { $gte: since }
        }).distinct('userId');
        const toNotify = becameEligible.filter(id => !alreadyTold.map(String).includes(id));

        const result = await notify.events.donorBecameEligible(toNotify);

        res.status(200).json({
            message: `${result.createdCount} donor(s) notified that they are eligible again`,
            windowDays,
            becameEligible: becameEligible.length,
            skippedAlreadyNotified: becameEligible.length - toNotify.length,
            notified: result.createdCount
        });
    } catch (error) { next(error); }
};

exports.markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) return res.status(404).json({ message: 'Notification not found' });

        // Reading someone else's notification is not permitted.
        const isAdmin = String((req.user || {}).roleId) === '0';
        if (!isAdmin && String(notification.userId) !== String(req.user.userId)) {
            return res.status(403).json({ message: 'You may only update your own notifications' });
        }

        notification.isRead = true;
        notification.readAt = notification.readAt || new Date();
        await notification.save();
        res.status(200).json(notification);
    } catch (error) { next(error); }
};

exports.markAllAsReadForUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const isAdmin = String((req.user || {}).roleId) === '0';
        if (!isAdmin && String(userId) !== String(req.user.userId)) {
            return res.status(403).json({ message: 'You may only update your own notifications' });
        }
        const result = await Notification.updateMany(
            { userId: String(userId), isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );
        res.status(200).json({ modifiedCount: result.modifiedCount });
    } catch (error) { next(error); }
};

exports.deleteNotification = async (req, res, next) => {
    try {
        const deleted = await Notification.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Notification not found' });
        res.status(200).json({ message: 'Notification deleted', deleted });
    } catch (error) { next(error); }
};
