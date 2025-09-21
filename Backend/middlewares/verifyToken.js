const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.token;

    if (authHeader) {
        const token = authHeader;
        jwt.verify(token, process.env.JWT_SEC, (err, user) => {
            if (err) return res.status(403).json("Token is invalid"); 
            console.log(user);
            req.user = user;
            next();
        });
    } else {
        return res.status(401).json("You're not authorized"); 
    }
};

const verifyTokenAndAuthorization = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.roleId === 0) {
            next();
        } else {
            return res.status(403).json("Only admin can access this"); 
        }
    });
};

module.exports = { verifyTokenAndAuthorization, verifyToken };