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
        height: req.body.height || null,
        weight: req.body.weight || null,
        roleId : payloadRoleDoc.roleId, 
        isActive: req.body.isActive
    });
    try {
        const user = await newUser.save();
        
        // If the user's role is 'donor', also create a donor record
        if (roleToUse !== 0) {
            const donorData = {
                name: `${req.body.firstName} ${req.body.lastName}`,
                email: req.body.email,
                phoneNumber: req.body.phoneNumber,
                bloodGroup: req.body.bloodGroup,
                // Required fields that might need to be added to user registration
                height: req.body.height || '',  // You'll need to add these to registration
                weight: req.body.weight || '',
                date: new Date().toISOString(),
                age: req.body.age || 0,        // Calculate from dateofBirth or get from registration
                bloodPressure: req.body.bloodPressure || 0,
                diseases: req.body.diseases || 'No',
                status: 0  // default status
            };

            const newDonor = new Donor(donorData);
            await newDonor.save();
        }

        // If address or locationGeo were provided in the request, create a UserProfile
        try {
            const profilePayload = {
                userId: user._id,
                address: req.body.address || undefined,
                city: req.body.city || undefined,
                state: req.body.state || undefined,
                country: req.body.country || undefined,
                pincode: req.body.pincode || undefined,
            };
            if (req.body.locationGeo && req.body.locationGeo.type === 'Point' && Array.isArray(req.body.locationGeo.coordinates) && req.body.locationGeo.coordinates.length === 2) {
                profilePayload.locationGeo = req.body.locationGeo;
                if (req.body.locationName) profilePayload.locationName = req.body.locationName;
            } else if (typeof req.body.latitude !== 'undefined' && typeof req.body.longitude !== 'undefined') {
                // support legacy flat lat/lng fields
                const lat = parseFloat(req.body.latitude);
                const lng = parseFloat(req.body.longitude);
                if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                    profilePayload.locationGeo = { type: 'Point', coordinates: [lng, lat] };
                }
            }
            // only create profile if we have some non-empty fields
            const hasProfileData = profilePayload.address || profilePayload.locationGeo;
            if (hasProfileData) {
                const UserProfile = require('../models/UserProfile');
                const newProfile = new UserProfile(profilePayload);
                await newProfile.save();
            }
        } catch (e) {
            console.warn('Failed to create initial user profile', e.message || e);
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
                    if (profile) {
                        if (profile.address) info.address = profile.address;
                        if (profile.locationGeo) info.locationGeo = profile.locationGeo;
                        if (profile.locationName) info.locationName = profile.locationName;
                    }
                } catch (e) {
                    // ignore profile lookup errors
                }
                // Include admin contact from env if provided
                info.adminEmail = process.env.ADMIN_EMAIL || 'admin@yourdomain.com';
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
        // Attach profile details if present
        try {
            const profile = await UserProfile.findOne({ userId: user._id }).lean();
            if (profile) {
                if (profile.address) info.address = profile.address;
                if (profile.locationGeo) info.locationGeo = profile.locationGeo;
                if (profile.locationName) info.locationName = profile.locationName;
            }
        } catch (e) { /* ignore */ }
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