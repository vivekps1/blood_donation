const express = require("express") ; 
const { verifyTokenAndAuthorization, verifyToken } = require("../middlewares/verifyToken");
const { createRole, getAllRoles, updateRole, deleteRole } = require("../controllers/roles");
const router = express.Router() ; 


// Add Role 
router.post("/", verifyTokenAndAuthorization,createRole) ; 

//Get All Roles 
router.get("/", verifyTokenAndAuthorization, getAllRoles) ; 

// Update Roles 

router.put("/:id", verifyTokenAndAuthorization, updateRole) ;

//Delete Roles 
router.delete("/:id", verifyTokenAndAuthorization,deleteRole) ;


module.exports= router