const express = require("express") ; 
const { createDonor, getAlldonors, updateDonor, deleteDonor, getOneDonor, getDonorsStats } = require("../controllers/donor");
const router = express.Router() ; 


// Add donor 
router.post("/", createDonor) ; 

//Get All Donors 
router.get("/", getAlldonors) ; 

// Update Donors 

router.put("/:id", updateDonor) ;

//Delete Donors 
router.delete("/", deleteDonor) ;

//Get one Donor 
router.get("/find/:id", getOneDonor) ;

//Donor stats 
router.get("/", getDonorsStats) ; 

module.exports= router