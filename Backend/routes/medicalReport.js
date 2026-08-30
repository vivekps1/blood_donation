const express = require('express');
const router = express.Router();
const controller = require('../controllers/medicalReport');
const { verifyToken } = require('../middlewares/verifyToken');
const { requirePermission, attachRole } = require('../middlewares/permissions');
const upload = require('../middlewares/upload');

// attachRole lets the handlers distinguish "may read every report" from "may read my own",
// which is enforced inside the controller rather than by blanket route-level denial.
router.use(verifyToken, attachRole);

// Filing a report is a clinical act, restricted to roles holding viewMedicalReports.
router.post('/', requirePermission('viewMedicalReports'), upload.single('file'), controller.createReport);
router.put('/:id', requirePermission('viewMedicalReports'), upload.single('file'), controller.updateReport);
router.delete('/:id', requirePermission('manageUsers'), controller.deleteReport);

// Reads are scoped to the caller inside the controller: donors see only their own.
router.get('/', controller.getReports);
router.get('/user/:userId/latest', controller.getLatestForUser);
router.get('/:id', controller.getReportById);

module.exports = router;
