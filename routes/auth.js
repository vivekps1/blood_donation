const express = require("express"); 
const { loginUser, registerUser } = require("../controllers/auth");
const router = express.Router() ;

//Register Router 

router.post("/login", loginUser); 

//Login Router

router.post("/register", registerUser);

module.exports=router
