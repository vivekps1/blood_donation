const CryptoJs = require("crypto-js");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const dotenv = require("dotenv");
const Roles = require("../models/Roles");
dotenv.config();

// Register user

const registerUser = async (req, res) => {

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
        roleId : req.body.roleId, 
        isActive: req.body.isActive
    });
    try {
        const user = await newUser.save();
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
            return res.status(403).json({ msg: `You're not ${payloadRole}` });
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

module.exports = {loginUser, registerUser}