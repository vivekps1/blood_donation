const express = require('express');
const router = express.Router();
const { getSystemStats } = require('../controllers/stats');
const { verifyTokenAndAdmin, verifyToken } = require('../middlewares/verifyToken');

// Public stats endpoint — protect as needed. For now allow any authenticated user.
router.get('/', verifyToken, getSystemStats);

module.exports = router;
