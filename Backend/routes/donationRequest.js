const express = require("express");
const router = express.Router();
const controller = require("../controllers/donationRequest");
const { verifyToken } = require("../middlewares/verifyToken");
const { requirePermission, requireVerified, attachRole } = require("../middlewares/permissions");
const { validateBody, rules } = require("../middlewares/validate");
const upload = require('../middlewares/upload');

router.use(verifyToken, attachRole);

// Donor-facing views.
// Declared before "/:id" so the literal paths are not swallowed by the parameter route.
router.get("/open-for-me", controller.getRequestsOpenForDonor);

// Matching (synopsis 9.b.3/9.b.4) — administrators can preview or re-run a match.
router.get("/:id/matches", requirePermission('manageDonationRequests'), controller.getMatchesForRequest);
router.post("/:id/rematch", requirePermission('manageDonationRequests'), controller.rematchRequest);

router.get("/", controller.getAllDonationRequests);
router.get("/:id", controller.getDonationRequestById);

// Raising a request commits a hospital to expecting blood, so it requires a verified
// account (the contact details are how the donor and hospital reach each other).
router.post("/", requireVerified, validateBody({
    patientName: ['required', rules.maxLength(100)],
    bloodGroup: ['required', 'bloodGroup'],
    bloodUnitsCount: ['required', 'positiveInt'],
    priority: [rules.oneOf(['Normal', 'Urgent', 'Critical', 'Low', 'Medium', 'High'])],
    medicalCondition: [rules.maxLength(200)],
    requiredDate: ['futureDate']
}), controller.createDonationRequest);

// Approving, rejecting, closing and completing are administrative acts.
router.put("/:id", requirePermission('manageDonationRequests'), controller.updateDonationRequest);
router.delete("/:id", requirePermission('manageDonationRequests'), controller.deleteDonationRequest);

// Volunteering.
router.post("/:requestId/volunteer", requireVerified, upload.single('file'), controller.volunteerForDonation);

// Filing the outcome of a donation is clinical and administrative.
router.post("/:requestId/volunteer/:volunteerId/report",
    requirePermission('manageDonationRequests', 'viewMedicalReports'),
    upload.single('file'),
    controller.saveVolunteerReport);

module.exports = router;
