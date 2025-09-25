const mongoose = require("mongoose") ; 

const DonationHistorySchema = mongoose.Schema({

    donationId: {type:String},
    userId: {type:String}, 
    hospitalId: {type:String}, 
    requestId: {type:String}, 
    reportId: {type:String}, 
    donationDate: { type: Date, required: true }, 
    donatedUnits:{type:Number}, 
    donationType: {type:String}, 
    status: {type:String}, 
    remarks : {type:String}
});

module.exports = mongoose.model("DonationHistory", DonationHistorySchema);