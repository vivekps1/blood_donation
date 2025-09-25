const express = require("express") ; 
const { createDonor, getAlldonors, updateDonor, deleteDonor, getOneDonor, getDonorsStats } = require("../controllers/donor");
const { verifyTokenAndAuthorization, verifyToken } = require("../middlewares/verifyToken");
const router = express.Router() ; 


// Add donor 
router.post("/",verifyToken, createDonor) ; 

//Get All Donors 
router.get("/",verifyTokenAndAuthorization, getAlldonors) ; 

// Update Donors 

router.put("/:id",verifyToken, updateDonor) ;

//Delete Donors 
router.delete("/:id", verifyToken, deleteDonor) ;

//Donor stats 
router.get("/stats", verifyTokenAndAuthorization, getDonorsStats) ;

//Get one Donor 
router.get("/:id",verifyToken, getOneDonor) ;

module.exports= router