const mongoose = require("mongoose") ;

// Medical report issued against a donor, per tb_medical_report in the synopsis
// (section 8, Database Design) and the "Generate Medical Report" / "View Medical Report"
// processes in both Level-1 data flow diagrams.
//
// The schema existed but nothing ever wrote to it — proof of donation was stored as a
// bare file path on the donation request. Reports are now first-class records with the
// clinical fields the report specifies, and the donation history links back to them.

const MedicalReportSchema = mongoose.Schema({
    reportId : {type:String, index: true},

    // Links the synopsis requires: report -> user, report -> hospital.
    userId: { type: String, required: true, index: true },
    hospitalId: { type: String, index: true },
    requestId: { type: String, index: true },
    donationId: { type: String },

    reportDate: {type:Date, default: Date.now},
    // Screening before a donation, or the post-donation record.
    reportType: {type:String, enum: ['Screening', 'Post-Donation', 'General'], default: 'Screening'},
    filePath: {type:String},

    hemoglobinLevel : {type:String},
    bloodPressure: {type:String},
    sugarLevel: {type:String},

    // tb_medical_report.is_fit_to_donate — drives donor eligibility.
    isEligible: {type:Boolean, default:false},
    testResult: {type:String},
    medicalCondition: {type:String},
    doctorName: {type:String},

    // Who filed the report (admin or hospital user).
    createdBy: { type: String }
}, { timestamps: true });

MedicalReportSchema.index({ userId: 1, reportDate: -1 });

module.exports = mongoose.model("MedicalReport", MedicalReportSchema) ;
