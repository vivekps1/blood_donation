// Authentication, account verification, referrals and password management.
//
// Changes against the original implementation:
//  * Passwords are hashed with scrypt instead of stored under reversible AES. Existing
//    AES records still authenticate and are re-hashed on the owner's next sign-in.
//  * Registration now sends the verification code by email and SMS that synopsis
//    section 9.b.1 describes, and records the result.
//  * Referral / invitation links are implemented (synopsis 9.b.1).
//  * Change password, forgot password and reset password exist, as promised by
//    synopsis section 10.
//  * Deactivated accounts (isActive false) are refused at sign-in, which is what makes
//    the administrator's activate/deactivate control in the Admin Dashboard meaningful.

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const UserProfile = require('../models/UserProfile');
const Donor = require("../models/Donor");
const Roles = require("../models/Roles");
const password = require("../utils/password");
const notify = require("../utils/notify");
const dotenv = require("dotenv");
dotenv.config();

const VERIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_VERIFICATION_ATTEMPTS = 5;
const TOKEN_TTL = "5d";

const signToken = (user) => jwt.sign(
    { userId: user._id, roleId: user.roleId },
    process.env.JWT_SEC,
    { expiresIn: TOKEN_TTL }
);

// Build the client-facing user object: never the password, always the readable role.
const publicUser = async (user) => {
    const { password: _pw, verificationCodeHash, verificationExpires, verificationAttempts,
            passwordResetTokenHash, passwordResetExpires, ...info } = user._doc || user;
    const role = await Roles.findOne({ roleId: user.roleId }).lean();
    info.userRole = role ? role.userRole : undefined;
    info.permissions = role || null;

    try {
        const profile = await UserProfile.findOne({ userId: user._id }).lean();
        if (profile) {
            if (profile.address) info.address = profile.address;
            if (profile.locationGeo) info.locationGeo = profile.locationGeo;
            if (profile.locationName) info.locationName = profile.locationName;
            if (profile.photo && !info.photo) info.photo = profile.photo;
        }
    } catch (e) { /* profile is optional */ }

    return info;
};

// Issue and dispatch a fresh verification code. Only the hash is stored.
const issueVerificationCode = async (user) => {
    const code = password.generateNumericCode(6);
    user.verificationCodeHash = password.hashToken(code);
    user.verificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
    user.verificationAttempts = 0;
    await user.save();

    // Delivery failure must not fail registration — the user can always request a resend.
    try {
        await notify.events.accountVerification(user, code);
    } catch (err) {
        console.warn('[auth] failed to send verification code:', err.message || err);
    }
    return code;
};

// A short, unambiguous invitation code. Retries on the (very unlikely) collision.
const generateUniqueReferralCode = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = password.generateToken(4).toUpperCase(); // 8 hex characters
        if (!(await User.exists({ referralCode: code }))) return code;
    }
    // Fall back to something guaranteed unique rather than looping forever.
    return `R${Date.now().toString(36).toUpperCase()}`;
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const registerUser = async (req, res, next) => {
    try {
        const roleToUse = req.body.roleId !== undefined ? Number(req.body.roleId) : 1;

        // Self-registration may only ever create a donor account. Without this check
        // anyone could POST roleId 0 and mint themselves an administrator.
        const roleDoc = await Roles.findOne({ roleId: roleToUse });
        if (!roleDoc) return res.status(400).json({ msg: "Invalid role specified" });
        if (roleDoc.userRole !== 'donor') {
            return res.status(403).json({ msg: "Only donor accounts can be created by self-registration. Ask an administrator to create staff logins." });
        }

        const strength = password.validatePasswordStrength(req.body.password);
        if (!strength.valid) {
            return res.status(400).json({ msg: strength.errors[0], code: 'WEAK_PASSWORD', errors: strength.errors });
        }

        const email = String(req.body.email || '').toLowerCase().trim();

        // Duplicate check, reported per field so the form can highlight the right input.
        const [emailClash, phoneClash] = await Promise.all([
            User.findOne({ email }).lean(),
            User.findOne({ phoneNumber: req.body.phoneNumber }).lean()
        ]);
        if (emailClash || phoneClash) {
            const fields = {};
            const parts = [];
            if (emailClash) { fields.email = true; parts.push('email'); }
            if (phoneClash) { fields.phoneNumber = true; parts.push('phone number'); }
            return res.status(409).json({ code: 'DUPLICATE', msg: `${parts.join(' and ')} already exists`, fields });
        }

        // Referral: if the sign-up came through an invitation link, remember who sent it.
        let referrer = null;
        if (req.body.referralCode) {
            referrer = await User.findOne({ referralCode: String(req.body.referralCode).toUpperCase().trim() });
        }

        const newUser = new User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email,
            password: await password.hashPassword(req.body.password),
            phoneNumber: req.body.phoneNumber,
            bloodGroup: req.body.bloodGroup,
            dateofBirth: req.body.dateofBirth,
            address: req.body.address,
            height: req.body.height || null,
            weight: req.body.weight || null,
            locationName: req.body.locationName,
            locationGeo: req.body.locationGeo,
            roleId: roleDoc.roleId,
            isActive: true,
            // The account exists but is unverified until the emailed/texted code is entered.
            isVerified: false,
            referralCode: await generateUniqueReferralCode(),
            referredBy: referrer ? referrer._id : undefined
        });

        const user = await newUser.save();

        if (referrer) {
            await User.updateOne({ _id: referrer._id }, { $inc: { referralCount: 1 } });
            notify.notifyUser(referrer, {
                category: 'REFERRAL_JOINED',
                title: 'Someone joined using your invitation',
                message: `${user.firstName} has registered as a donor using your invitation link. Thank you for growing the donor network.`
            }).catch(() => { /* best effort */ });
        }

        // Donors need a Donor record or the matching algorithm will never see them.
        let age = 0;
        if (req.body.dateofBirth) {
            const dob = new Date(req.body.dateofBirth);
            age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
        }
        await new Donor({
            userId: user._id,
            name: `${req.body.firstName} ${req.body.lastName || ''}`.trim(),
            email,
            address: req.body.address,
            phoneNumber: req.body.phoneNumber,
            bloodGroup: req.body.bloodGroup,
            height: req.body.height !== undefined ? String(req.body.height) : '',
            weight: req.body.weight !== undefined ? String(req.body.weight) : '',
            date: new Date().toISOString(),
            dateofBirth: req.body.dateofBirth || null,
            age,
            bloodPressure: req.body.bloodPressure || 0,
            diseases: req.body.diseases || 'No',
            status: 0
        }).save();

        // Extended profile, when the registration form collected location details.
        if (req.body.address || req.body.locationGeo) {
            try {
                await new UserProfile({
                    userId: user._id,
                    address: req.body.address || undefined,
                    city: req.body.city || undefined,
                    state: req.body.state || undefined,
                    country: req.body.country || undefined,
                    pincode: req.body.pincode || undefined,
                    locationGeo: req.body.locationGeo || undefined,
                    locationName: req.body.locationName || undefined
                }).save();
            } catch (e) {
                console.warn('[auth] failed to create initial user profile:', e.message || e);
            }
        }

        await issueVerificationCode(user);

        res.status(201).json({
            user: await publicUser(user),
            accessToken: signToken(user),
            verificationRequired: true,
            msg: 'Registration successful. A verification code has been sent to your email and phone.'
        });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

const loginUser = async (req, res, next) => {
    try {
        const { role: payloadRole } = req.body;
        const email = String(req.body.email || '').toLowerCase().trim();

        const user = await User.findOne({ email }).select('+password');
        // Same message whether the address is unknown or the password is wrong, so the
        // endpoint cannot be used to enumerate which addresses are registered.
        const invalid = () => res.status(401).json({ msg: "Invalid email or password" });
        if (!user) return invalid();

        const { valid, needsRehash } = await password.verifyPassword(req.body.password, user.password);
        if (!valid) return invalid();

        // Transparently upgrade legacy AES records to scrypt on successful sign-in.
        if (needsRehash) {
            try {
                user.password = await password.hashPassword(req.body.password);
                await user.save();
            } catch (e) {
                console.warn('[auth] password re-hash failed:', e.message || e);
            }
        }

        if (user.isActive === false) {
            return res.status(403).json({ code: 'ACCOUNT_INACTIVE', msg: 'Your account has been deactivated. Please contact the blood bank.' });
        }

        // The frontend sends the role the user picked on the login screen; hold them to it.
        if (payloadRole) {
            const requested = await Roles.findOne({ userRole: payloadRole });
            if (!requested) return res.status(401).json({ msg: "Invalid role specified" });
            if (Number(user.roleId) !== Number(requested.roleId)) {
                return res.status(403).json({ msg: `You're not ${payloadRole}` });
            }
        }

        user.lastLoginAt = new Date();
        await user.save();

        res.status(200).json({
            user: await publicUser(user),
            accessToken: signToken(user),
            verificationRequired: user.isVerified === false
        });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Account verification (synopsis 9.b.1)
// ---------------------------------------------------------------------------

const verifyAccount = async (req, res, next) => {
    try {
        const { code } = req.body;
        const email = req.body.email ? String(req.body.email).toLowerCase().trim() : null;

        // Accept either the signed-in user or an email + code pair.
        const query = req.user && req.user.userId ? { _id: req.user.userId } : { email };
        if (!query._id && !query.email) return res.status(400).json({ msg: 'Provide the email address used to register' });

        const user = await User.findOne(query).select('+verificationCodeHash +verificationExpires +verificationAttempts');
        if (!user) return res.status(404).json({ msg: 'Account not found' });
        if (user.isVerified) return res.status(200).json({ msg: 'Account is already verified', verified: true });

        if (!user.verificationCodeHash || !user.verificationExpires || user.verificationExpires < new Date()) {
            return res.status(410).json({ code: 'CODE_EXPIRED', msg: 'That code has expired. Request a new one.' });
        }
        if ((user.verificationAttempts || 0) >= MAX_VERIFICATION_ATTEMPTS) {
            return res.status(429).json({ code: 'TOO_MANY_ATTEMPTS', msg: 'Too many incorrect attempts. Request a new code.' });
        }

        if (password.hashToken(String(code || '').trim()) !== user.verificationCodeHash) {
            user.verificationAttempts = (user.verificationAttempts || 0) + 1;
            await user.save();
            return res.status(400).json({
                code: 'CODE_INVALID',
                msg: 'That code is not correct',
                attemptsRemaining: Math.max(0, MAX_VERIFICATION_ATTEMPTS - user.verificationAttempts)
            });
        }

        user.isVerified = true;
        user.emailVerifiedAt = new Date();
        user.phoneVerifiedAt = new Date();
        user.verificationCodeHash = undefined;
        user.verificationExpires = undefined;
        user.verificationAttempts = 0;
        await user.save();

        res.status(200).json({ msg: 'Account verified', verified: true, user: await publicUser(user) });
    } catch (error) { next(error); }
};

const resendVerification = async (req, res, next) => {
    try {
        const email = req.body.email ? String(req.body.email).toLowerCase().trim() : null;
        const query = req.user && req.user.userId ? { _id: req.user.userId } : { email };
        if (!query._id && !query.email) return res.status(400).json({ msg: 'Provide the email address used to register' });

        const user = await User.findOne(query);
        if (!user) return res.status(404).json({ msg: 'Account not found' });
        if (user.isVerified) return res.status(200).json({ msg: 'Account is already verified', verified: true });

        await issueVerificationCode(user);
        res.status(200).json({ msg: 'A new verification code has been sent to your email and phone.' });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Password management (synopsis section 10)
// ---------------------------------------------------------------------------

const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const strength = password.validatePasswordStrength(newPassword);
        if (!strength.valid) return res.status(400).json({ msg: strength.errors[0], errors: strength.errors });

        const user = await User.findById(req.user.userId).select('+password');
        if (!user) return res.status(404).json({ msg: 'Account not found' });

        const { valid } = await password.verifyPassword(currentPassword, user.password);
        if (!valid) return res.status(401).json({ msg: 'Your current password is not correct' });

        // Refuse a "change" that changes nothing.
        const sameAsBefore = await password.verifyPassword(newPassword, user.password);
        if (sameAsBefore.valid) return res.status(400).json({ msg: 'The new password must be different from the current one' });

        user.password = await password.hashPassword(newPassword);
        user.passwordChangedAt = new Date();
        await user.save();

        notify.notifyUser(user, {
            category: 'PASSWORD_CHANGED',
            title: 'Your password was changed',
            message: 'Your password was changed successfully. If this was not you, contact the blood bank immediately.'
        }).catch(() => {});

        res.status(200).json({ msg: 'Password changed successfully' });
    } catch (error) { next(error); }
};

const forgotPassword = async (req, res, next) => {
    try {
        const email = String(req.body.email || '').toLowerCase().trim();
        const user = await User.findOne({ email });

        // Always answer the same way, so this endpoint cannot be used to discover which
        // addresses hold accounts.
        const genericResponse = { msg: 'If that email is registered, a reset code has been sent to it.' };
        if (!user) return res.status(200).json(genericResponse);

        const token = password.generateNumericCode(6);
        user.passwordResetTokenHash = password.hashToken(token);
        user.passwordResetExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
        await user.save();

        try {
            await notify.events.passwordReset(user, token);
        } catch (err) {
            console.warn('[auth] failed to send reset code:', err.message || err);
        }

        res.status(200).json(genericResponse);
    } catch (error) { next(error); }
};

const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        const email = String(req.body.email || '').toLowerCase().trim();

        const strength = password.validatePasswordStrength(newPassword);
        if (!strength.valid) return res.status(400).json({ msg: strength.errors[0], errors: strength.errors });

        const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpires +password');
        if (!user || !user.passwordResetTokenHash) {
            return res.status(400).json({ msg: 'That reset code is not valid' });
        }
        if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
            return res.status(410).json({ code: 'TOKEN_EXPIRED', msg: 'That reset code has expired. Request a new one.' });
        }
        if (password.hashToken(String(token || '').trim()) !== user.passwordResetTokenHash) {
            return res.status(400).json({ msg: 'That reset code is not valid' });
        }

        user.password = await password.hashPassword(newPassword);
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpires = undefined;
        user.passwordChangedAt = new Date();
        await user.save();

        res.status(200).json({ msg: 'Password reset successfully. You can now sign in with your new password.' });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Referrals (synopsis 9.b.1)
// ---------------------------------------------------------------------------

// GET /api/v1/auth/referral — the signed-in user's invitation code, link and tally.
const getMyReferral = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ msg: 'Account not found' });

        // Older accounts predate the referral programme and have no code yet.
        if (!user.referralCode) {
            user.referralCode = await generateUniqueReferralCode();
            await user.save();
        }

        const base = process.env.APP_URL || 'http://localhost:5173';
        const referrals = await User.find({ referredBy: user._id })
            .select('firstName lastName createdAt isVerified').sort({ createdAt: -1 }).limit(50).lean();

        res.status(200).json({
            referralCode: user.referralCode,
            invitationLink: `${base}/register?ref=${user.referralCode}`,
            referralCount: referrals.length,
            referrals
        });
    } catch (error) { next(error); }
};

// GET /api/v1/auth/referral/:code — used by the registration form to show who invited you.
const validateReferralCode = async (req, res, next) => {
    try {
        const referrer = await User.findOne({ referralCode: String(req.params.code).toUpperCase().trim() })
            .select('firstName lastName').lean();
        if (!referrer) return res.status(404).json({ valid: false, msg: 'That invitation code is not recognised' });
        res.status(200).json({ valid: true, referrerName: `${referrer.firstName} ${referrer.lastName || ''}`.trim() });
    } catch (error) { next(error); }
};

module.exports = {
    loginUser,
    registerUser,
    verifyAccount,
    resendVerification,
    changePassword,
    forgotPassword,
    resetPassword,
    getMyReferral,
    validateReferralCode
};
