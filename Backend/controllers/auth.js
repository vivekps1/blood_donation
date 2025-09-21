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

        const user = await newUser.save()
        res.status(201).json(user)
    } catch (error) {
        res.status(500).json(user)

    }
}

//Login User 

const loginUser = async (req, res) => {

    try {

        const user = await User.findOne({ email: req.body.email });        
        if (!user) {
            return res.status(401).json("You have not registered");
        }
        const hashedPassword = CryptoJs.AES.decrypt(
            user.password,
            process.env.PASS
        );
        const originalPassword = hashedPassword.toString(CryptoJs.enc.Utf8)
        console.log(req.body.password)
        if (originalPassword !== req.body.password) {
            return res.status(401).json("Invalid Username or Password")
        }

        const role = await Roles.findOne({ roleId: user.roleId });

        const { password, ...info } = user._doc;
        const accessToken = jwt.sign(
            { userId: user._id, roleId: user.roleId },
            process.env.JWT_SEC,
            { expiresIn: "5d" }
        ) ; 
        info.userRole = role.userRole ;
        res.status(200).json({...info, accessToken })

    } catch (error) {
        res.status(500).json(error) ;
    }

}; 

module.exports = {loginUser, registerUser}