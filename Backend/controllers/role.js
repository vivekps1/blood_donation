// Roles and permissions (tb_roles_and_permission).
//
// The create endpoint was previously unauthenticated: any anonymous caller could POST a
// role with every permission flag set to true and then have themselves assigned to it.
// It now requires the manageUsers permission, and the role definitions the application
// depends on are seeded rather than hand-created.

const Role = require('../models/Roles');
const { invalidateRoleCache } = require('../middlewares/permissions');

// The three roles the synopsis describes. USER is the donor; ADMIN is the administrator;
// HOSPITAL exists because the ER diagram has HOSPITAL generating donation requests and
// issuing medical reports, which needs a login of its own.
const DEFAULT_ROLES = [
    {
        roleId: 0,
        userRole: 'admin',
        manageUsers: true,
        manageHospitals: true,
        manageDonationRequests: true,
        viewMedicalReports: true,
        viewReports: true,
        generateNotifications: true,
        accessLevel: 'full',
        description: 'Full administrative oversight of the blood donation platform'
    },
    {
        roleId: 1,
        userRole: 'donor',
        manageUsers: false,
        manageHospitals: false,
        manageDonationRequests: false,
        // A donor reads their own medical reports and donation history without needing a
        // permission flag — those controllers scope every read to the caller. These flags
        // govern access to *other people's* records and to organisation-wide reporting.
        viewMedicalReports: false,
        viewReports: false,
        generateNotifications: false,
        accessLevel: 'self',
        description: 'Registered donor: manages their own profile, raises requests and volunteers to donate'
    },
    {
        roleId: 2,
        userRole: 'hospital',
        manageUsers: false,
        manageHospitals: false,
        manageDonationRequests: true,
        viewMedicalReports: true,
        viewReports: true,
        generateNotifications: true,
        accessLevel: 'hospital',
        description: 'Hospital staff: raises and manages donation requests and files medical reports for their hospital'
    }
];

// Idempotent: safe to run on every deployment. Existing roles keep any permission an
// administrator has customised, so seeding never silently revokes access — it only fills
// in roles and flags that are missing.
const seedRoles = async () => {
    const results = [];
    for (const role of DEFAULT_ROLES) {
        const existing = await Role.findOne({ roleId: role.roleId });
        if (!existing) {
            await Role.create(role);
            results.push({ roleId: role.roleId, userRole: role.userRole, action: 'created' });
            continue;
        }
        const missing = {};
        Object.entries(role).forEach(([key, value]) => {
            if (typeof existing[key] === 'undefined' || existing[key] === null) missing[key] = value;
        });
        if (Object.keys(missing).length) {
            await Role.updateOne({ _id: existing._id }, { $set: missing });
            results.push({ roleId: role.roleId, userRole: role.userRole, action: 'updated', fields: Object.keys(missing) });
        } else {
            results.push({ roleId: role.roleId, userRole: role.userRole, action: 'unchanged' });
        }
    }
    invalidateRoleCache();
    return results;
};

const createRole = async (req, res, next) => {
    try {
        if (typeof req.body.roleId === 'undefined' || !req.body.userRole) {
            return res.status(400).json({ message: 'roleId and userRole are required' });
        }
        const clash = await Role.findOne({ $or: [{ roleId: req.body.roleId }, { userRole: req.body.userRole }] });
        if (clash) return res.status(409).json({ message: 'A role with that roleId or name already exists' });

        const savedRole = await Role.create(req.body);
        invalidateRoleCache();
        res.status(201).json(savedRole);
    } catch (error) { next(error); }
};

const updateRole = async (req, res, next) => {
    try {
        const updates = { ...req.body };
        // The numeric id is embedded in every issued JWT, so it must not change.
        delete updates.roleId;

        const role = await Role.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!role) return res.status(404).json({ message: 'Role not found' });

        invalidateRoleCache();
        res.status(200).json(role);
    } catch (error) { next(error); }
};

const getRoles = async (req, res, next) => {
    try {
        res.status(200).json(await Role.find().sort({ roleId: 1 }));
    } catch (error) { next(error); }
};

const seedRolesHandler = async (req, res, next) => {
    try {
        res.status(200).json({ message: 'Roles seeded', results: await seedRoles() });
    } catch (error) { next(error); }
};

module.exports = { createRole, getRoles, updateRole, seedRoles, seedRolesHandler, DEFAULT_ROLES };
