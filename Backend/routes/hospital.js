const express = require("express") ; 
const { createHospital, getAllHospitals, updateHospital, deleteHospital, getOneHospital, getHospitalStats, getNearbyHospitals } = require("../controllers/hospital");
const { verifyTokenAndAuthorization, verifyToken } = require("../middlewares/verifyToken");
const router = express.Router() ; 


// Add Hospital 
router.post("/", verifyTokenAndAuthorization,createHospital) ; 

//Get All Hospitals 
router.get("/", verifyToken, getAllHospitals) ; 

// Nearby hospitals (query: lat, lng, radius in meters)
router.get('/nearby', verifyToken, getNearbyHospitals);

// Update Hospitals 

router.put("/:id", verifyTokenAndAuthorization, updateHospital) ;

//Delete Hospitals 
router.delete("/:id", verifyTokenAndAuthorization,deleteHospital) ;

//Get one Hospital 
router.get("/:id",verifyToken ,getOneHospital) ;

//Hospital stats 
router.get("/stats", getHospitalStats) ; 

module.exports= router