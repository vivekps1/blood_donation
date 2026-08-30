const express = require('express');
const router = express.Router();
const { createRole, getRoles, updateRole, seedRolesHandler } = require('../controllers/role');
const { verifyToken } = require('../middlewares/verifyToken');
const { requirePermission } = require('../middlewares/permissions');

// The login and registration screens need the role list to populate their selector, so
// reading roles stays open. Nothing sensitive is exposed: it is the permission matrix,
// not anyone's access.
router.get('/', getRoles);

// Creating or editing a role changes what every holder of it may do, so it is gated on
// manageUsers. This endpoint previously had no authentication at all.
router.post('/', verifyToken, requirePermission('manageUsers'), createRole);
router.put('/:id', verifyToken, requirePermission('manageUsers'), updateRole);
router.post('/seed', verifyToken, requirePermission('manageUsers'), seedRolesHandler);

module.exports = router;
