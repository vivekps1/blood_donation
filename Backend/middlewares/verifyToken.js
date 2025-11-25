const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (authHeader) {
            // support header values like "Bearer <token>" or raw token
            let token = authHeader;
            if (typeof token === 'string' && token.startsWith('Bearer ')) token = token.slice('Bearer '.length);
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