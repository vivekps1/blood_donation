// Role-based authorization.
//
// The synopsis (section 8, tb_roles_and_permission) defines per-role permission flags —
// manage_users, manage_hospitals, manage_donation_requests, view_medical_reports,
// generate_notifications — and section 10 describes "role-based access controls" as a
// core security mechanism.
//
// Until now none of those flags was ever read: the only check in the codebase was
// `req.user.roleId === 0`, so authorization was hard-coded to "admin or nobody" and the
// permission table was decorative. These middlewares read the flags.

const Roles = require('../models/Roles');
const User = require('../models/User');

// Roles change rarely but are needed on nearly every request, so they are cached in
// process for a short window rather than fetched per call.
const ROLE_CACHE_TTL_MS = 60 * 1000;
let roleCache = { at: 0, byId: new Map() };

const loadRoles = async () => {
    const now = Date.now();
    if (now - roleCache.at < ROLE_CACHE_TTL_MS && roleCache.byId.size) return roleCache.byId;
    const roles = await Roles.find().lean();
    roleCache = { at: now, byId: new Map(roles.map(r => [Number(r.roleId), r])) };
    return roleCache.byId;
};

// Called after a role is created or edited so the next request sees the change.
const invalidateRoleCache = () => { roleCache = { at: 0, byId: new Map() }; };

const getRoleForRequest = async (req) => {
    if (!req.user || typeof req.user.roleId === 'undefined') return null;
    const byId = await loadRoles();
    return byId.get(Number(req.user.roleId)) || null;
};

// Require one of the named permission flags from tb_roles_and_permission.
// Usage: router.get('/', verifyToken, requirePermission('manageUsers'), handler)
const requirePermission = (...flags) => async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).json({ message: 'No role is configured for this account' });
        }
        const granted = flags.some(flag => role[flag] === true);
        if (!granted) {
            return res.status(403).json({
                message: `This action requires the ${flags.join(' or ')} permission`,
                requiredPermission: flags
            });
        }
        req.role = role;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message || 'Authorization check failed' });
    }
};

// Require a named role (e.g. 'admin', 'hospital'). Prefer requirePermission where a flag
// exists — this is for cases where the role itself is the subject, such as hospital staff
// acting for their own hospital.
const requireRole = (...roleNames) => async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role || !roleNames.includes(role.userRole)) {
            return res.status(403).json({ message: `This action is restricted to: ${roleNames.join(', ')}` });
        }
        req.role = role;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message || 'Authorization check failed' });
    }
};

// Attaches the caller's role and full user document without enforcing anything, so
// handlers can branch on it (e.g. admins see all requests, donors see their own).
const attachRole = async (req, res, next) => {
    try {
        if (req.user) {
            req.role = await getRoleForRequest(req);
            req.isAdmin = Boolean(req.role && req.role.userRole === 'admin');
        }
        next();
    } catch (err) {
        next();
    }
};

// Actions that commit someone to a real-world clinical event (volunteering to donate,
// raising a request) require a verified contact address, since that is how the hospital
// will reach them. Synopsis 9.b.1: verification is sent by SMS and email at registration.
const requireVerified = async (req, res, next) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "You're not authorized" });
        }
        const user = await User.findById(req.user.userId).lean();
        if (!user) return res.status(401).json({ message: 'Account not found' });
        if (user.isActive === false) {
            return res.status(403).json({ code: 'ACCOUNT_INACTIVE', message: 'Your account has been deactivated. Please contact the blood bank.' });
        }
        if (user.isVerified === false) {
            return res.status(403).json({
                code: 'ACCOUNT_UNVERIFIED',
                message: 'Please verify your email or phone number before performing this action.'
            });
        }
        req.currentUser = user;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message || 'Verification check failed' });
    }
};

// Allow the owner of a resource through, or anyone holding the given permission.
// `getOwnerId` extracts the owning user id from the request.
const requireSelfOrPermission = (getOwnerId, ...flags) => async (req, res, next) => {
    try {
        const ownerId = typeof getOwnerId === 'function' ? getOwnerId(req) : req.params[getOwnerId];
        if (req.user && ownerId && String(req.user.userId) === String(ownerId)) return next();
        return requirePermission(...flags)(req, res, next);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Authorization check failed' });
    }
};

module.exports = {
    requirePermission,
    requireRole,
    requireVerified,
    requireSelfOrPermission,
    attachRole,
    getRoleForRequest,
    invalidateRoleCache
};
