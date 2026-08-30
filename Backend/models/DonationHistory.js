const mongoose = require("mongoose") ;

// One row per actual donation, per tb_donation_history in the synopsis.
//
// This collection is the input to donor eligibility, the aggregate report and the
// "eligible donors" notification audience. It was previously only ever written by a
// standalone admin endpoint that the application never called, so it stayed empty and
// silently defeated all three of those features. Donation history is now created
// automatically whenever a donation is confirmed (controllers/donationRequest.js).

const DonationHistorySchema = mongoose.Schema({
    donationId: {type:String, index: true},
    userId: {type:String, index: true},
    hospitalId: {type:String},
    requestId: {type:String, index: true},
    reportId: {type:String},
    donationDate: { type: Date, required: true },
    donatedUnits:{type:Number, default: 1},
    donationType: {type:String, default: 'Whole Blood'},
    // 'Success' marks a completed donation and starts the donor's 90-day waiting period.
    status: {type:String, default: 'Success'},
    remarks : {type:String}
}, { timestamps: true });

// Eligibility looks up "latest successful donation for this user".
DonationHistorySchema.index({ userId: 1, status: 1, donationDate: -1 });
// Guards against a donation being recorded twice for the same donor on the same request.
DonationHistorySchema.index({ requestId: 1, userId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("DonationHistory", DonationHistorySchema);
