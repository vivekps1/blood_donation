const Hospital = require("../models/Hospital") ;

// Create Hospital Functionality 

const createHospital = async (req, res) =>{
try{
    // console.log(req.body)
    const newHospital = Hospital(req.body) ; 
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
    const updateHospital = await Hospital.findByIdAndUpdate(
        req.params.id , 
        {$set:req.body}, 
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
        if(!hospital){
            res.status(404).json("The hospital is not registered on our database")
        }else{
            res.status(200).json(hospital)
        }
    }catch(error){
        res.status(500).json(error)
    }
}

//Delete Hospital 

const deleteHospital = async (req, res) =>{
    try{
        const hospital = await Hospital.findByIdAndDelete(req.params.id); 
        res.status(201).json("Deleted hospital successfully") ;
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