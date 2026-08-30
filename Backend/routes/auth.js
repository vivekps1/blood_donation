const express = require("express");
const router = express.Router();
const {
    loginUser, registerUser, verifyAccount, resendVerification,
    changePassword, forgotPassword, resetPassword,
    getMyReferral, validateReferralCode
} = require("../controllers/auth");
const { verifyToken } = require("../middlewares/verifyToken");
const { authLimiter } = require("../middlewares/security");
const { validateBody } = require("../middlewares/validate");

// Every credential endpoint is rate limited to blunt password and code guessing.
router.use(authLimiter);

router.post("/login", validateBody({
    email: ['required', 'email'],
    password: ['required']
}), loginUser);

router.post("/register", validateBody({
    firstName: ['required'],
    email: ['required', 'email'],
    phoneNumber: ['required', 'phone'],
    bloodGroup: ['required', 'bloodGroup'],
    password: ['required'],
    dateofBirth: ['date']
}), registerUser);

// Account verification. Both accept either a bearer token or an email in the body, so the
// code can be entered from the signed-in app or from a fresh browser session.
router.post("/verify", validateBody({ code: ['required'] }), verifyAccount);
router.post("/resend-verification", resendVerification);

// Password management.
router.post("/change-password", verifyToken, validateBody({
    currentPassword: ['required'],
    newPassword: ['required']
}), changePassword);
router.post("/forgot-password", validateBody({ email: ['required', 'email'] }), forgotPassword);
router.post("/reset-password", validateBody({
    email: ['required', 'email'],
    token: ['required'],
    newPassword: ['required']
}), resetPassword);

// Referral / invitation links.
router.get("/referral", verifyToken, getMyReferral);
router.get("/referral/:code", validateReferralCode);

module.exports = router;
