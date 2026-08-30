const mongoose = require("mongoose") ;

const DonationRequestSchema = mongoose.Schema({
    requestId: {type:String}, 
    adminId: {type:String}, 
    hospitalId: {type:String}, 
    // Snapshot of hospital details at time of request
    hospitalName: { type: String },
    hospitalAddress: { type: String },
    hospitalPhone: { type: String },
    hospitalLocation: { type: String },
    hospitalLocationGeo: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: { type: [Number], default: void 0 }
    },
    // ID of the user who created/requested this donation request
    requestedBy: { type: String },
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
        volunteeredAt: { type: Date, default: Date.now },
        fulfilled: { type: Boolean, default: true },
        medicalProofFile: { type: String }, // file path or filename
        donationSuccess: { type: Boolean }, // whether donation succeeded based on medical report
        // Set once the donation is confirmed, linking the response to the permanent
        // records it produced. Their presence marks the volunteer as already processed,
        // so confirming twice cannot double-count a donation.
        medicalReportId: { type: String },
        donationHistoryId: { type: String },
        unitsDonated: { type: Number },
        confirmedAt: { type: Date }
    }],
    availableDonors: {type:Number}, 
    requiredDate: {type:Date}
    ,
    // Fields to track fulfillment/closure
    fulfilledBy: { type: String },
    fulfilledByName: { type: String },
    fulfilledByList: { type: [String], default: undefined },
    fulfilledByNames: { type: [String], default: undefined },
    fulfilledAt: { type: Date },
    closedAt: { type: Date },
    closedReason: { type: String },

    // Synopsis 9.b.3: a request "becom[es] non-interactive when marked as completed or
    // after receiving four responses". This is that cap, stored per request so an
    // administrator can raise it for a large or critical requirement.
    maxVolunteers: { type: Number, default: 4, min: 1 },

    // Units actually collected, as opposed to bloodUnitsCount which is what was asked for.
    unitsFulfilled: { type: Number, default: 0, min: 0 },

    // Set when an administrator declines a request, so the requester can be told why.
    rejectedReason: { type: String },
    rejectedAt: { type: Date },

    // Outcome of the automatic matching run triggered on approval (utils/matching.js),
    // retained so the dashboard can show who was contacted and when.
    matching: {
        lastRunAt: { type: Date },
        notifiedCount: { type: Number, default: 0 },
        notifiedUserIds: { type: [String], default: undefined },
        radiusKm: { type: Number }
    }

}, { timestamps: true });

// A request stops accepting responses once it is closed out or the response cap is met.
DonationRequestSchema.methods.isOpenForVolunteers = function () {
    const status = String(this.status || '').toUpperCase();
    if (['COMPLETED', 'CLOSED', 'REJECTED', 'PENDING'].includes(status)) return false;
    return (this.volunteers || []).length < (this.maxVolunteers || 4);
};

// create 2dsphere index on hospitalLocationGeo to support geospatial queries
DonationRequestSchema.index({ hospitalLocationGeo: '2dsphere' });

module.exports = mongoose.model("DonationRequest", DonationRequestSchema); 