const mongoose = require("mongoose") ;

const DonationRequestSchema = mongoose.Schema({
    requestId: {type:String}, 
    adminId: {type:String}, 
    hospitalId: {type:String}, 
    patientName: {type:String}, 
    bloodGroup: {type:String, require:true}, 
    bloodUnitsCount: {type:Number, require:true}, 
    medicalCondition: {type:String}, 
    priority: {type:String, require:true}, 
    requestDate: {type:Date, require:true}, 
    status: {type:String}, 
    location:{type:String}, 
    availableDonors: {type:Number}, 
    requiredDate: {type:Date}

});

module.exports = mongoose.model("DonationRequest", DonationRequestSchema); 