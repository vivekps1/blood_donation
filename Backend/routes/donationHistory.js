const express = require("express");
const router = express.Router();
const { createDonationEntry, getAllDonationEntries, updateDonationEntry,
        deleteDonationEntry, getOneDonationEntry, getDonationEntriesStats,
        getDonationEntryIdsByUser } = require("../controllers/donationHistory");
const { verifyToken } = require("../middlewares/verifyToken");
const { requirePermission } = require("../middlewares/permissions");

router.use(verifyToken);

// Literal paths before "/:id".
router.get("/stats", requirePermission('viewReports', 'manageUsers'), getDonationEntriesStats);
router.get("/user/:userId/ids", getDonationEntryIdsByUser);

// Donation history is normally written automatically when a donation is confirmed
// (controllers/donationRequest.js). This manual entry point remains for back-filling
// records migrated from the paper system, which the synopsis calls for in section 5.
router.post("/", requirePermission('manageDonationRequests'), createDonationEntry);
router.get("/", requirePermission('viewReports', 'manageUsers'), getAllDonationEntries);
router.put("/:id", requirePermission('manageDonationRequests'), updateDonationEntry);
router.delete("/:id", requirePermission('manageDonationRequests'), deleteDonationEntry);
router.get("/:id", getOneDonationEntry);

module.exports = router;
