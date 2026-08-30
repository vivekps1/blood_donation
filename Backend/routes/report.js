const express = require('express');
const router = express.Router();
const controller = require('../controllers/report');
const { verifyToken } = require('../middlewares/verifyToken');
const { requirePermission } = require('../middlewares/permissions');

// tb_roles_and_permission.view_reports is the flag that gates this whole module.
router.use(verifyToken, requirePermission('viewReports', 'manageUsers'));

router.get('/summary', controller.summaryReport);
router.get('/donations', controller.donationsReport);
router.get('/donors', controller.donorsReport);
router.get('/requests', controller.requestsReport);
router.get('/inventory', controller.inventoryReport);

module.exports = router;
