const mongoose = require("mongoose") ;

const UserProfileSchema = mongoose.Schema({
    profileId : {type:Number} ,
    userId: {type:Number} , 
    address: {type:String}, 
    city: {type:String}, 
    state: {type:String}, 
    country: {type:String}, 
    pincode: {type:String}, 
    height: {type:Number, require:true}, 
    weight: {type:Number, require:true},
    medicalHistory: {type:String}, 
    lastDonationDate: {type:Date}, 
    donorStatus: {type:Boolean, default:false} 
})

module.exports = mongoose.model("UserProfile", UserProfileSchema) ;