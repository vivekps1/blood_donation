const CryptoJs = require("crypto-js");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Donor = require("../models/Donor");
const dotenv = require("dotenv");
const Roles = require("../models/Roles");
const axios = require("axios");
dotenv.config();

// Register user

const registerUser = async (req, res) => {

    // Fetch roleId for the payload role (ensure roleId exists)
    const payloadRoleDoc = await Roles.findOne({ userRole: req.body.role, roleId: { $ne: null } });
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
        roleId : payloadRoleDoc.roleId, 
        isActive: req.body.isActive
    });
    try {
        const user = await newUser.save();
        
        // If the user's role is 'donor', also create a donor record
        if (req.body.role === 'donor') {
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

        res.status(201).json(user);
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
        res.status(200).json({ ...info, accessToken });
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