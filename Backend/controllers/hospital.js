const Hospital = require("../models/Hospital") ;

// Create Hospital Functionality 

const createHospital = async (req, res) =>{
try{
    // console.log(req.body)
    const payload = { ...req.body };
    // Normalize hospitalId to string if provided
    if (payload.hospitalId != null) {
        payload.hospitalId = String(payload.hospitalId);
    }
    // Auto-generate a hospitalId if none supplied (simple timestamp-based ID)
    if (!payload.hospitalId) {
        payload.hospitalId = `H-${Date.now()}`;
    }
    // Convert isVerified from possible 'true'/'false' strings to Boolean
    if (typeof payload.isVerified === 'string') {
        payload.isVerified = payload.isVerified === 'true';
    }
    const newHospital = Hospital(payload) ; 
    const hospital = await newHospital.save() ; 
    res.status(201).json(hospital)

}catch(error){
    res.status(500).json(error) ;
}

}

//Get all Hospitals 

const getAllHospitals = async (req, res) => {
    try{
        const  hospitals = await Hospital.find().sort({createdAt:-1}) ;
        res.status(200).json(hospitals)
    }catch(error){
        res.status(500).json(error)
    }
}

//Update Hospital 

const updateHospital = async (req, res) => {
 try{
    console.log(req.body)
    if(Object.keys(req.body).length == 0){
        return res.status(204).json("Nothing updated")
    }
    const updatePayload = { ...req.body };
    if (updatePayload.hospitalId != null) {
        updatePayload.hospitalId = String(updatePayload.hospitalId);
    }
    if (typeof updatePayload.isVerified === 'string') {
        updatePayload.isVerified = updatePayload.isVerified === 'true';
    }
    const updateHospital = await Hospital.findByIdAndUpdate(
        req.params.id , 
        {$set:updatePayload}, 
        {new:true}
    )
    res.status(200).json(updateHospital)
 }  catch(error){
    res.status(500).json(error)
 } 
} ; 

//GET One Hospital 

const getOneHospital = async (req, res) => {
    try{
        const hospital = await Hospital.findById(req.params.id) ;
        if (!hospital) {
            return res.status(404).json({ message: "Hospital not found" });
        }
        res.status(200).json(hospital)
    }catch(error){
        res.status(500).json(error)
    }
}

//Delete Hospital 

const deleteHospital = async (req, res) =>{
    try{
        const hospital = await Hospital.findByIdAndDelete(req.params.id); 
         if (!hospital) {
            return res.status(404).json({ message: "Hospital not found" });
        }
        res.status(200).json({"message" :"Deleted hospital successfully", hospital });
    }catch(error){
        res.status(500).json(error)
    }
}

//Stats 

const getHospitalStats = async (req, res) =>{

    try{
        id = req._id
        const stats = await Hospital.aggregate([
            {
                $group:{
                    _id:"$hospitalId",
                    count: {$sum:1}
                }
            }
        ]) ; 
        res.status(200).json(stats) ;

    }catch(error){
        res.status(500).json(error) ; 
        
    }
}

module.exports = {deleteHospital, getOneHospital, getAllHospitals,getHospitalStats,updateHospital, createHospital}