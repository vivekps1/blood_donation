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
    approved: {type:Boolean, default:false},
    location:{type:String}, 
    volunteers: [{
        donorId: { type: String },
        donorName: { type: String },
        contact: { type: String },
        expectedDonationTime: { type: Date },
        message: { type: String },
        volunteeredAt: { type: Date, default: Date.now }
    }],
    availableDonors: {type:Number}, 
    requiredDate: {type:Date}
    ,
    // Fields to track fulfillment/closure
    fulfilledBy: { type: String },
    fulfilledByName: { type: String },
    fulfilledAt: { type: Date },
    closedAt: { type: Date },
    closedReason: { type: String }

});

module.exports = mongoose.model("DonationRequest", DonationRequestSchema); 