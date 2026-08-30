const express = require('express');
const router = express.Router();
const controller = require('../controllers/bloodInventory');
const { verifyToken } = require('../middlewares/verifyToken');
const { requirePermission } = require('../middlewares/permissions');
const { validateBody } = require('../middlewares/validate');

// Movement payloads share the same shape.
const movementSchema = {
    hospitalId: ['required'],
    bloodGroup: ['required', 'bloodGroup'],
    units: ['required', 'positiveInt']
};

// Reading stock is open to any signed-in user: donors are shown where their blood group
// is scarce, which is the point of publishing inventory at all.
router.get('/', verifyToken, controller.getInventory);
router.get('/availability', verifyToken, controller.getAvailability);
router.get('/transactions', verifyToken, requirePermission('manageHospitals', 'manageUsers'), controller.getTransactions);

// Changing stock requires the hospital-management permission.
router.post('/stock-in', verifyToken, requirePermission('manageHospitals'), validateBody(movementSchema), controller.stockIn);
router.post('/stock-out', verifyToken, requirePermission('manageHospitals'), validateBody(movementSchema), controller.stockOut);
router.post('/reserve', verifyToken, requirePermission('manageHospitals', 'manageDonationRequests'), validateBody(movementSchema), controller.reserve);
router.post('/release', verifyToken, requirePermission('manageHospitals', 'manageDonationRequests'), validateBody(movementSchema), controller.release);
router.post('/expire', verifyToken, requirePermission('manageHospitals'), controller.runExpiry);
router.put('/:id/threshold', verifyToken, requirePermission('manageHospitals'), controller.updateThreshold);

module.exports = router;
