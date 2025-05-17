const mongoose = require("mongoose") ;

const HospitalSchema = mongoose.Schema({
  hospitalId : {type: Number} , 
  hospitalName: {type:String, reqyire:true}, 
  regNo : {type:Number, require:true}, 
  contactName: {type:String, require:true} ,
  email : {type:String, require:true}, 
  phoneNumber: {type:String, require:true}, 
  address: {type:String, require:true} ,
  city : {type:String, require:true}, 
  state: {type:String, require:true}, 
  pincode:{type:String, require:true}, 
  isVerified:{type:String, default:false} 

})

module.exports = mongoose.model("Hospital", HospitalSchema) ;