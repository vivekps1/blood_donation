const express = require('express');
const router = express.Router();
const userProfileController = require('../controllers/userProfile');
const { verifyToken } = require('../middlewares/verifyToken');
const multer = require('multer');
const path = require('path');

// Setup multer storage for profile images
const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-pics');
const fs = require('fs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		const ext = path.extname(file.originalname) || '.jpg';
		cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
	}
});
const upload = multer({ 
	storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
	fileFilter: (req, file, cb) => {
		if (!file.mimetype.startsWith('image/')) {
			return cb(new Error('Only image files are allowed'), false);
		}
		cb(null, true);
	}
});

// Get user profile by userId
router.get('/:userId', verifyToken, userProfileController.getUserProfile);

// Create user profile
router.post('/', userProfileController.createUserProfile);

// Update user profile
router.put('/:userId', verifyToken, userProfileController.updateUserProfile);

// Upload profile photo
router.post('/:userId/photo', verifyToken, upload.single('photo'), userProfileController.uploadProfilePhoto);

module.exports = router;
