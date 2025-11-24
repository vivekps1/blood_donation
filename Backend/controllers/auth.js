const CryptoJs = require("crypto-js");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const UserProfile = require('../models/UserProfile');
const Donor = require("../models/Donor");
const dotenv = require("dotenv");
const Roles = require("../models/Roles");
const axios = require("axios");
dotenv.config();

// Register user

const registerUser = async (req, res) => {

    // Determine role for new user. If not provided, default to 'donor'.
    const roleToUse = req.body.roleId !== undefined ? req.body.roleId : 1; // default to donor roleId = 1

    console.log("Registering user with roleId:", roleToUse);
    console.log("Request body:", req.body.roleId );

    // Fetch roleId for the payload role (ensure roleId exists)
    const payloadRoleDoc = await Roles.findOne({ roleId: roleToUse });
    if (!payloadRoleDoc || typeof payloadRoleDoc.roleId === 'undefined') {
        return res.status(401).json({ msg: "Invalid role specified" });
    }

    // Duplicate validation for email and phone
    try {
        const dupChecks = await Promise.all([
            User.findOne({ email: req.body.email }).lean(),
            User.findOne({ phoneNumber: req.body.phoneNumber }).lean()
        ]);
        const dupFields = {};
        if (dupChecks[0]) dupFields.email = true;
        if (dupChecks[1]) dupFields.phoneNumber = true;
        if (Object.keys(dupFields).length) {
            const parts = [];
            if (dupFields.email) parts.push('email');
            if (dupFields.phoneNumber) parts.push('phone number');
            return res.status(409).json({ code: 'DUPLICATE', msg: `${parts.join(' and ')} already exists`, fields: dupFields });
        }
    } catch (e) {
        return res.status(500).json({ msg: e.message || e });
    }

    const newUser = User({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        userName: req.body.userName,
        email: req.body.email,
        password: CryptoJs.AES.encrypt(
            req.body.password,
            process.env.PASS
        ).toString() ,
        phoneNumber: req.body.phoneNumber,
        bloodGroup : req.body.bloodGroup, 
        dateofBirth: req.body.dateofBirth ,
        address: req.body.address,
        height: req.body.height || null,
        weight: req.body.weight || null,
        roleId : payloadRoleDoc.roleId, 
        isActive: req.body.isActive
    });
    try {
        const user = await newUser.save();
        
        // Create donor record only if role is not admin (roleId !=0 and userRole != 'admin')
        if (roleToUse !== 0 && payloadRoleDoc.userRole !== 'admin') {
            // derive age from dateofBirth if provided
            let age = 0;
            if (req.body.dateofBirth) {
                const dob = new Date(req.body.dateofBirth);
                const diff = Date.now() - dob.getTime();
                const ageDt = new Date(diff);
                age = Math.abs(ageDt.getUTCFullYear() - 1970);
            }
            const donorData = {
                userId: user._id,
                name: `${req.body.firstName} ${req.body.lastName}`.trim(),
                email: req.body.email,
                address: req.body.address,
                phoneNumber: req.body.phoneNumber,
                bloodGroup: req.body.bloodGroup,
                height: (req.body.height !== undefined ? String(req.body.height) : ''),
                weight: (req.body.weight !== undefined ? String(req.body.weight) : ''),
                date: new Date().toISOString(),
                dateofBirth: req.body.dateofBirth || null,
                age: age,
                bloodPressure: req.body.bloodPressure || 0,
                diseases: req.body.diseases || 'No',
                status: 0
            };
            await new Donor(donorData).save();
        }

        // create token and return sanitized user object
        const accessToken = jwt.sign(
            { userId: user._id, roleId: user.roleId },
            process.env.JWT_SEC,
            { expiresIn: "5d" }
        );
        const { password, ...info } = user._doc;
        // attach readable userRole
        const roleDoc = await Roles.findOne({ roleId: user.roleId });
                info.userRole = roleDoc ? roleDoc.userRole : undefined;
                // Attach additional safe fields
                info.phoneNumber = user.phoneNumber;
                info.bloodGroup = user.bloodGroup;
                // Try to attach address from UserProfile if it exists
                try {
                    const profile = await UserProfile.findOne({ userId: user._id }).lean();
                    if (profile && profile.address) {
                        info.address = profile.address;
                    }
                } catch (e) {
                    // ignore profile lookup errors
                }
                // Include admin contact from env if provided
                info.adminEmail = process.env.ADMIN_EMAIL || 'admin@yourdomain.com';
                console.log("Registered user info:", info);
                console.log("env email:", process.env.ADMIN_EMAIL);
                res.status(200).json({ user: info, accessToken });
    } catch (error) {
        res.status(500).json({ msg: error.message || error });
    }
}

//Login User 

const loginUser = async (req, res) => {
    try {
        const { email, role: payloadRole } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ msg: "You have not registered" });
        }
        const hashedPassword = CryptoJs.AES.decrypt(
            user.password,
            process.env.PASS
        );
        const originalPassword = hashedPassword.toString(CryptoJs.enc.Utf8);
        if (originalPassword !== req.body.password) {
            return res.status(401).json({ msg: "Invalid Username or Password" });
        }

        // Fetch roleId for the payload role (ensure roleId exists)
        const payloadRoleDoc = await Roles.findOne({ userRole: payloadRole, roleId: { $ne: null } });
        if (!payloadRoleDoc || typeof payloadRoleDoc.roleId === 'undefined') {
            return res.status(401).json({ msg: "Invalid role specified" });
        }
        // Check if user's roleId matches the payload roleId
        if (String(user.roleId) !== String(payloadRoleDoc.roleId)) {

            return res.status(403).json({ msg: `You're not ${payloadRole}`, obj : user });
        }

        const role = await Roles.findOne({ roleId: user.roleId });
        const { password, ...info } = user._doc;
        const accessToken = jwt.sign(
            { userId: user._id, roleId: user.roleId },
            process.env.JWT_SEC,
            { expiresIn: "5d" }
        );
        info.userRole = role.userRole;
        // attach admin email so frontend can render contact link
        info.adminEmail = process.env.ADMIN_EMAIL || 'admin@yourdomain.com';
        // respond with consistent shape: { user, accessToken }
        res.status(200).json({ user: info, accessToken });
    } catch (error) {
        res.status(500).json({ msg: error.message || error });
    }
}; 

// Example of using axios to make a GET request to a protected route
const getProtectedData = async (token) => {
    try {
        const response = await axios.get('/api/protected', {
            headers: { Authorization: token }
        });
        return response.data;
    } catch (error) {
        throw new Error('Error fetching protected data');
    }
};

module.exports = {loginUser, registerUser, getProtectedData}