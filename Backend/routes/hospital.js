const express = require("express");
const router = express.Router();
const { createHospital, getAllHospitals, updateHospital, deleteHospital,
        getOneHospital, getHospitalStats, getNearbyHospitals } = require("../controllers/hospital");
const { verifyToken } = require("../middlewares/verifyToken");
const { requirePermission } = require("../middlewares/permissions");
const { validateBody } = require("../middlewares/validate");

router.use(verifyToken);

// Literal paths are declared before "/:id". "/stats" was previously registered after it,
// so a request for /stats was captured by the parameter route and answered with a cast
// error rather than the statistics. It was also the only unauthenticated route on this
// router.
router.get("/stats", requirePermission('manageHospitals', 'viewReports'), getHospitalStats);
router.get('/nearby', getNearbyHospitals);

router.get("/", getAllHospitals);
router.get("/:id", getOneHospital);

router.post("/", requirePermission('manageHospitals'), validateBody({
    hospitalName: ['required'],
    regNo: ['required'],
    contactName: ['required'],
    email: ['required', 'email'],
    phoneNumber: ['required', 'phone'],
    address: ['required'],
    pincode: ['required']
}), createHospital);

router.put("/:id", requirePermission('manageHospitals'), validateBody({
    email: ['email'], phoneNumber: ['phone']
}), updateHospital);

router.delete("/:id", requirePermission('manageHospitals'), deleteHospital);

module.exports = router;
