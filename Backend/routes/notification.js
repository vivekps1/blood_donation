const express = require('express');
const router = express.Router();
const controller = require('../controllers/notification');
const { verifyToken } = require('../middlewares/verifyToken');
const { requirePermission } = require('../middlewares/permissions');

router.use(verifyToken);

// Every signed-in user reads and manages their own inbox.
router.get('/', controller.getNotifications);
router.put('/:id/read', controller.markAsRead);
router.put('/user/:userId/read-all', controller.markAllAsReadForUser);

// Broadcasting and reporting need the generateNotifications permission.
router.post('/', requirePermission('generateNotifications'), controller.createNotification);
router.post('/audience-preview', requirePermission('generateNotifications'), controller.previewAudience);
router.post('/eligibility-sweep', requirePermission('generateNotifications'), controller.runEligibilitySweep);
router.get('/stats', requirePermission('generateNotifications'), controller.getNotificationStats);

router.delete('/:id', requirePermission('generateNotifications'), controller.deleteNotification);

module.exports = router;
