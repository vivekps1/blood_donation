const Roles = require("../models/Roles") ;

// Create Roles Functionality 

const createRole = async (req, res) =>{
try{
    // console.log(req.body)
    const newRoles = Roles(req.body) ; 
    const role = await newRoles.save() ; 
    res.status(201).json(role)

}catch(error){
    res.status(500).json(error) ;
}

}

//Get all Roles 

const getAllRoles = async (req, res) => {
    try{
        const  roles = await Roles.find().sort({createdAt:-1}) ;
        res.status(200).json(roles)
    }catch(error){
        res.status(500).json(error)
    }
}

//Update Role 

const updateRole = async (req, res) => {
 try{
    console.log(req.body)
    if(Object.keys(req.body).length == 0){
        return res.status(204).json("Nothing updated")
    }
    const updateRole = await Roles.findByIdAndUpdate(
        req.params.id , 
        {$set:req.body}, 
        {new:true}
    )
    res.status(200).json(updateRole)
 }  catch(error){
    res.status(500).json(error)
 } 
} ; 


//Delete Role 

const deleteRole = async (req, res) =>{
    try{
        const role = await Roles.findByIdAndDelete(req.params.id); 
        res.status(201).json("Deleted role successfully") ;
    }catch(error){
        res.status(500).json(error)
    }
}



module.exports = {deleteRole, getAllRoles,updateRole, createRole}