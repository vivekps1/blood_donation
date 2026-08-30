const express = require("express");
const router = express.Router();
const { createDonor, getAlldonors, updateDonor, deleteDonor, getOneDonor,
        getDonorsStats, getDonorEligibility } = require("../controllers/donor");
const { verifyToken } = require("../middlewares/verifyToken");
const { requirePermission } = require("../middlewares/permissions");
const { validateBody } = require("../middlewares/validate");

router.use(verifyToken);

// Literal paths first, so "/:id" does not capture them.
// A donor may always check their own eligibility; the controller enforces that.
router.get("/eligibility/:userId", getDonorEligibility);
router.get("/stats", requirePermission('manageUsers', 'manageDonationRequests'), getDonorsStats);

router.post("/", requirePermission('manageUsers'), validateBody({
    name: ['required'],
    email: ['required', 'email'],
    phoneNumber: ['required', 'phone'],
    bloodGroup: ['required', 'bloodGroup']
}), createDonor);

router.get("/", requirePermission('manageUsers', 'manageDonationRequests'), getAlldonors);

// A donor may update their own record; otherwise the manageUsers permission is required.
router.put("/:id", validateBody({
    email: ['email'], phoneNumber: ['phone'], bloodGroup: ['bloodGroup']
}), updateDonor);
router.delete("/:id", requirePermission('manageUsers'), deleteDonor);
router.get("/:id", getOneDonor);

module.exports = router;
