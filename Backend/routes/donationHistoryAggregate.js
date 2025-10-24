const express = require('express');
const router = express.Router();
const { getDonationHistoryAggregate } = require('../controllers/donationHistoryAggregate');
const { verifyToken } = require('../middlewares/verifyToken');

// Secure the aggregate endpoint with auth (adjust to role-based guard if needed)
router.get('/aggregate', verifyToken, getDonationHistoryAggregate);

module.exports = router;
