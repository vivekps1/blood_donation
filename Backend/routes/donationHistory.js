const express = require("express") ; 
const { verifyTokenAndAuthorization, verifyToken } = require("../middlewares/verifyToken");
const { createDonationEntry, getAllDonationEntries, updateDonationEntry, deleteDonationEntry, getOneDonationEntry, getDonationEntriesStats, getDonationEntryIdsByUser } = require("../controllers/donationHistory");
const router = express.Router() ; 


// NOTE: Order matters. Place more specific paths BEFORE any generic ":id" matcher.

// Add donation entry
router.post("/",verifyTokenAndAuthorization, createDonationEntry) ;

// Get All Donation Entries
router.get("/",verifyTokenAndAuthorization, getAllDonationEntries) ;

// Donation Entry stats
router.get("/stats", verifyTokenAndAuthorization, getDonationEntriesStats) ;

// Get Donation Entry IDs by User (must be before ":id")
router.get("/user/:userId/ids", verifyToken, getDonationEntryIdsByUser);

// Update Donation Entries
router.put("/:id",verifyTokenAndAuthorization, updateDonationEntry) ;

// Delete Donation Entries
router.delete("/:id", verifyTokenAndAuthorization, deleteDonationEntry) ;

// Get one Donation Entry
router.get("/:id",verifyToken, getOneDonationEntry) ;

module.exports= router