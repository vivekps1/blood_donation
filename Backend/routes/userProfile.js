const express = require('express');
const router = express.Router();
const userProfileController = require('../controllers/userProfile');

// Get user profile by userId
router.get('/:userId', userProfileController.getUserProfile);

// Create user profile
router.post('/', userProfileController.createUserProfile);

// Update user profile
router.put('/:userId', userProfileController.updateUserProfile);

module.exports = router;
