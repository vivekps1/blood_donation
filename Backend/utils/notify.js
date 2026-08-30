// Central notification service.
//
// Synopsis section 9.b.5 describes the Notification module as event-driven: notifications
// are "generated when a donation request is created or a user becomes eligible to donate",
// delivered over "multiple channels, prioritizing user preferences", with the system
// tracking "notification delivery and engagement".
//
// Previously the only way a Notification document came into existence was an admin
// manually posting to /api/v1/notifications. Every domain event now calls into this
// module instead, so the workflow the report describes actually runs.

const Notification = require('../models/Notification');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

// The transporter is expensive to build and was previously re-created (and re-verified)
// on every single request. Build it once, lazily.
let cachedTransporter;
let transporterUnavailable = false;

const getTransporter = () => {
    if (cachedTransporter || transporterUnavailable) return cachedTransporter;
    if (!process.env.SMTP_HOST) {
        transporterUnavailable = true;
        return null;
    }
    try {
        cachedTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
            tls: { rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === 'true' }
        });
        return cachedTransporter;
    } catch (err) {
        console.warn('[notify] email transport unavailable:', err.message || err);
        transporterUnavailable = true;
        return null;
    }
};

let cachedTwilio;
let twilioUnavailable = false;

const getTwilio = () => {
    if (cachedTwilio || twilioUnavailable) return cachedTwilio;
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        twilioUnavailable = true;
        return null;
    }
    try {
        cachedTwilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        return cachedTwilio;
    } catch (err) {
        // twilio is an optional dependency; without it SMS is simulated and logged.
        console.warn('[notify] SMS transport unavailable:', err.message || err);
        twilioUnavailable = true;
        return null;
    }
};

const sendEmail = async (to, subject, body) => {
    const transporter = getTransporter();
    if (!transporter) return { status: 'skipped', error: 'No SMTP transport configured' };
    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM || 'no-reply@blooddonation.local',
            to,
            subject,
            text: body
        });
        return { status: 'sent', sentAt: new Date() };
    } catch (err) {
        return { status: 'failed', error: String(err.message || err) };
    }
};

const sendSms = async (to, body) => {
    const client = getTwilio();
    if (!client) {
        // Keeps development usable without Twilio credentials and makes the intended
        // message visible in the server log.
        console.log(`[notify] simulated SMS -> ${to}: ${body}`);
        return { status: 'skipped', error: 'No SMS transport configured' };
    }
    try {
        await client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to });
        return { status: 'sent', sentAt: new Date() };
    } catch (err) {
        return { status: 'failed', error: String(err.message || err) };
    }
};

// ---------------------------------------------------------------------------
// Core dispatch
// ---------------------------------------------------------------------------

const DEFAULT_CHANNELS = ['app'];

// Which channels a given user should receive this notification on. Urgent clinical events
// escalate to SMS + email; routine ones stay in-app. This is the "intelligent routing"
// and "user preferences" behaviour described in section 9.b.5.
const resolveChannels = (user, requested, priority) => {
    if (Array.isArray(requested) && requested.length) return requested;
    if (requested === 'both') return ['app', 'email', 'sms'];
    if (typeof requested === 'string' && requested) return ['app', requested].filter((v, i, a) => a.indexOf(v) === i);

    const prefs = (user && user.notificationPreferences) || {};
    const channels = ['app'];
    const urgent = ['CRITICAL', 'URGENT', 'HIGH'].includes(String(priority || '').toUpperCase());

    if (prefs.email !== false) channels.push('email');
    // SMS is reserved for urgent traffic unless the user explicitly opted in to all of it.
    if (prefs.sms === true || (urgent && prefs.sms !== false)) channels.push('sms');
    return channels;
};

// Deliver one notification to one user: persist it, then fan out to the chosen channels.
// Delivery failures never propagate — a notification is an ancillary concern and must not
// roll back the domain action (approving a request, recording a donation) that caused it.
const notifyUser = async (user, payload = {}) => {
    if (!user || !user._id) return null;

    const channels = resolveChannels(user, payload.channels, payload.priority);
    const doc = new Notification({
        userId: String(user._id),
        adminId: payload.adminId ? String(payload.adminId) : undefined,
        requestId: payload.requestId ? String(payload.requestId) : undefined,
        requestStatus: payload.requestStatus,
        notificationType: payload.notificationType || (channels.includes('sms') ? 'SMS' : 'Email'),
        category: payload.category,
        title: payload.title,
        message: payload.message,
        channels,
        meta: payload.meta,
        sentAt: new Date()
    });

    try {
        if (channels.includes('email') && user.email) {
            doc.delivery.email = await sendEmail(user.email, payload.title || 'Blood Donation Management System', payload.message || '');
        }
        if (channels.includes('sms') && user.phoneNumber) {
            doc.delivery.sms = await sendSms(user.phoneNumber, payload.message || '');
        }
    } catch (err) {
        console.warn('[notify] dispatch error:', err.message || err);
    }

    try {
        await doc.save();
    } catch (err) {
        console.error('[notify] failed to persist notification:', err.message || err);
        return null;
    }
    return doc;
};

// Deliver the same notification to many users.
const notifyUsers = async (users, payload = {}) => {
    const list = (users || []).filter(Boolean);
    if (!list.length) return { createdCount: 0, notifications: [] };
    const results = await Promise.allSettled(list.map(u => notifyUser(u, payload)));
    const notifications = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
    return { createdCount: notifications.length, notifications };
};

// Convenience: resolve ids to user documents before notifying.
const notifyUserIds = async (userIds, payload = {}) => {
    const ids = [...new Set((userIds || []).map(String).filter(Boolean))];
    if (!ids.length) return { createdCount: 0, notifications: [] };
    const users = await User.find({ _id: { $in: ids } });
    return notifyUsers(users, payload);
};

const notifyAdmins = async (payload = {}) => {
    // roleId 0 is the administrator role (see models/Roles.js seeding in controllers/role.js).
    const admins = await User.find({ roleId: 0 });
    return notifyUsers(admins, payload);
};

// ---------------------------------------------------------------------------
// Domain events
//
// Each helper below corresponds to an arrow in the Level-1 DFDs of the synopsis.
// ---------------------------------------------------------------------------

const events = {
    // A user submitted a request — administrators must review and approve it.
    requestCreated: (request) => notifyAdmins({
        category: 'REQUEST_CREATED',
        title: 'New donation request awaiting approval',
        message: `A ${request.priority || 'normal'} priority request for ${request.bloodUnitsCount || 1} unit(s) of ${request.bloodGroup} `
            + `has been raised${request.hospitalName ? ` at ${request.hospitalName}` : ''} for patient ${request.patientName || 'unknown'}. Review it to approve or reject.`,
        requestId: String(request._id),
        requestStatus: request.status,
        priority: request.priority,
        meta: { requestId: String(request._id), bloodGroup: request.bloodGroup }
    }),

    // The admin approved it — tell whoever raised it.
    requestApproved: (request) => (request.requestedBy ? notifyUserIds([request.requestedBy], {
        category: 'REQUEST_APPROVED',
        title: 'Your donation request was approved',
        message: `Your request for ${request.bloodUnitsCount || 1} unit(s) of ${request.bloodGroup} has been approved and is now visible to matching donors.`,
        requestId: String(request._id),
        requestStatus: 'APPROVED',
        priority: request.priority,
        meta: { requestId: String(request._id) }
    }) : { createdCount: 0, notifications: [] }),

    requestRejected: (request, reason) => (request.requestedBy ? notifyUserIds([request.requestedBy], {
        category: 'REQUEST_REJECTED',
        title: 'Your donation request was not approved',
        message: `Your request for ${request.bloodGroup} was not approved.${reason ? ` Reason: ${reason}` : ''}`,
        requestId: String(request._id),
        requestStatus: 'REJECTED',
        meta: { requestId: String(request._id) }
    }) : { createdCount: 0, notifications: [] }),

    // The matching algorithm found compatible, eligible, nearby donors.
    donorsMatched: (request, donorUserIds) => notifyUserIds(donorUserIds, {
        category: 'DONOR_MATCHED',
        title: `${request.bloodGroup} blood needed near you`,
        message: `A ${String(request.priority || 'normal').toLowerCase()} priority request needs ${request.bloodUnitsCount || 1} unit(s) of ${request.bloodGroup}`
            + `${request.hospitalName ? ` at ${request.hospitalName}` : ''}`
            + `${request.requiredDate ? `, required by ${new Date(request.requiredDate).toDateString()}` : ''}. `
            + `You are a compatible and eligible donor — open the app to volunteer.`,
        requestId: String(request._id),
        requestStatus: request.status,
        priority: request.priority,
        meta: { requestId: String(request._id), bloodGroup: request.bloodGroup, hospitalId: request.hospitalId }
    }),

    // A donor stepped forward — tell the requester and the administrators.
    donorVolunteered: async (request, volunteer) => {
        const recipients = [];
        if (request.requestedBy) recipients.push(String(request.requestedBy));
        const forRequester = recipients.length ? await notifyUserIds(recipients, {
            category: 'DONOR_VOLUNTEERED',
            title: 'A donor volunteered for your request',
            message: `${volunteer.donorName || 'A donor'} has volunteered for your ${request.bloodGroup} request`
                + `${volunteer.expectedDonationTime ? ` and expects to donate on ${new Date(volunteer.expectedDonationTime).toLocaleString()}` : ''}.`
                + `${volunteer.contact ? ` Contact: ${volunteer.contact}.` : ''}`,
            requestId: String(request._id),
            requestStatus: request.status,
            priority: request.priority,
            meta: { requestId: String(request._id), donorId: volunteer.donorId }
        }) : { createdCount: 0 };

        const forAdmins = await notifyAdmins({
            category: 'DONOR_VOLUNTEERED',
            title: 'Donor response recorded',
            message: `${volunteer.donorName || 'A donor'} volunteered for request ${request._id} (${request.bloodGroup}). `
                + `${request.availableDonors || 0} of ${request.maxVolunteers || 4} response slots used.`,
            requestId: String(request._id),
            requestStatus: request.status,
            meta: { requestId: String(request._id) }
        });

        return { createdCount: (forRequester.createdCount || 0) + (forAdmins.createdCount || 0) };
    },

    // Thanks + eligibility window, sent to the donor once a donation is recorded.
    donationRecorded: (donorUserId, request, nextEligibleDate) => notifyUserIds([donorUserId], {
        category: 'DONATION_RECORDED',
        title: 'Thank you for your donation',
        message: `Your donation of ${request && request.bloodGroup ? request.bloodGroup : 'blood'} has been recorded.`
            + `${nextEligibleDate ? ` You will be eligible to donate again from ${new Date(nextEligibleDate).toDateString()}.` : ''}`,
        requestId: request ? String(request._id) : undefined,
        meta: { requestId: request ? String(request._id) : undefined, nextEligibleDate }
    }),

    requestCompleted: (request) => (request.requestedBy ? notifyUserIds([request.requestedBy], {
        category: 'REQUEST_COMPLETED',
        title: 'Your donation request is fulfilled',
        message: `Your request for ${request.bloodUnitsCount || 1} unit(s) of ${request.bloodGroup} has been marked as completed.`,
        requestId: String(request._id),
        requestStatus: 'COMPLETED',
        meta: { requestId: String(request._id) }
    }) : { createdCount: 0, notifications: [] }),

    // The 90-day window elapsed — the donor can give again (see jobs/eligibilitySweep).
    donorBecameEligible: (userIds) => notifyUserIds(userIds, {
        category: 'DONOR_ELIGIBLE',
        title: 'You are eligible to donate again',
        message: 'The waiting period since your last donation has passed. You can now respond to donation requests again — thank you for giving.',
        meta: {}
    }),

    // Registration verification (synopsis 9.b.1: "sends verification via SMS and email").
    accountVerification: (user, code) => notifyUser(user, {
        category: 'ACCOUNT_VERIFICATION',
        title: 'Verify your account',
        message: `Welcome to the Blood Donation Management System. Your verification code is ${code}. It expires in 30 minutes.`,
        channels: ['app', 'email', 'sms'],
        meta: {}
    }),

    passwordReset: (user, token) => notifyUser(user, {
        category: 'PASSWORD_RESET',
        title: 'Password reset requested',
        message: `Use this code to reset your password: ${token}. It expires in 30 minutes. `
            + `If you did not request a reset you can ignore this message.`,
        channels: ['app', 'email'],
        meta: {}
    }),

    accountStatusChanged: (userId, isActive) => notifyUserIds([userId], {
        category: 'ACCOUNT_STATUS',
        title: isActive ? 'Your account has been activated' : 'Your account has been deactivated',
        message: isActive
            ? 'An administrator has activated your account. You can now sign in and respond to donation requests.'
            : 'An administrator has deactivated your account. Please contact the blood bank for assistance.',
        meta: { isActive }
    }),

    // Inventory fell below the configured threshold for a hospital/blood group.
    lowInventory: (hospital, bloodGroup, units, threshold) => notifyAdmins({
        category: 'LOW_INVENTORY',
        title: `Low stock: ${bloodGroup}`,
        message: `${hospital && hospital.hospitalName ? hospital.hospitalName : 'A hospital'} has ${units} unit(s) of ${bloodGroup} remaining, `
            + `below the reorder threshold of ${threshold}.`,
        priority: 'URGENT',
        meta: { hospitalId: hospital ? String(hospital._id) : undefined, bloodGroup, units, threshold }
    })
};

module.exports = {
    notifyUser,
    notifyUsers,
    notifyUserIds,
    notifyAdmins,
    resolveChannels,
    sendEmail,
    sendSms,
    events
};
