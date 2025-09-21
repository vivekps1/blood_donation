const express = require("express") ; 
const { createHospital, getAllHospitals, updateHospital, deleteHospital, getOneHospital, getHospitalStats } = require("../controllers/hospital");
const { verifyTokenAndAuthorization, verifyToken } = require("../middlewares/verifyToken");
const router = express.Router() ; 


// Add Hospital 
router.post("/", verifyTokenAndAuthorization,createHospital) ; 

//Get All Hospitals 
router.get("/", verifyToken, getAllHospitals) ; 

// Update Hospitals 

router.put("/:id", verifyTokenAndAuthorization, updateHospital) ;

//Delete Hospitals 
router.delete("/", verifyTokenAndAuthorization,deleteHospital) ;

//Get one Hospital 
router.get("/:id",verifyToken ,getOneHospital) ;

//Hospital stats 
router.get("/", getHospitalStats) ; 

module.exports= router