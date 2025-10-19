const express = require('express');
const router = express.Router();
const { verifyToken, verifyTokenAndAuthorization } = require('../middlewares/verifyToken');
const {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsReadForUser,
  deleteNotification,
} = require('../controllers/notification');

// Get notifications (supports query params: userId, isRead, type, page, size)
router.get('/', verifyToken, getNotifications);

// Create notification (admin only)
router.post('/', verifyTokenAndAuthorization, createNotification);

// Mark a single notification as read
router.put('/:id/read', verifyToken, markAsRead);

// Mark all notifications for a user as read (admin or the user)
router.put('/user/:userId/read-all', verifyToken, markAllAsReadForUser);

// Delete a notification (admin)
router.delete('/:id', verifyTokenAndAuthorization, deleteNotification);

module.exports = router;
