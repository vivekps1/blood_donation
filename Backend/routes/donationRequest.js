const express = require("express");
const router = express.Router();
const {
    getAllDonationRequests,
    getDonationRequestById,
    createDonationRequest,
    updateDonationRequest,
    deleteDonationRequest,
    volunteerForDonation
} = require("../controllers/donationRequest");
const { verifyToken } = require("../middlewares/verifyToken");

// Get all donation requests
router.get("/", verifyToken, getAllDonationRequests);

// Get donation request by ID
router.get("/:id", verifyToken, getDonationRequestById);

// Create new donation request
router.post("/", verifyToken, createDonationRequest);

// Update donation request
router.put("/:id", verifyToken, updateDonationRequest);

// Delete donation request
router.delete("/:id", verifyToken, deleteDonationRequest);

// Volunteer for a donation request
router.post("/:requestId/volunteer", verifyToken, volunteerForDonation);

module.exports = router;