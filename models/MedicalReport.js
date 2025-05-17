const mongoose = require("mongoose") ; 

const MedicalReportSchema = mongoose.Schema({
    reportId : {type:String}, 
    reportDate: {type:Date}, 
    reportType: {type:String}, 
    filePath: {type:String}, 
    hemoglobinLevel : {type:String}, 
    bloodPressure: {type:String}, 
    sugarLevel: {type:String}, 
    isEligible: {type:Boolean, default:false}, 
    testResult: {type:String}, 
    medicalCondition: {type:String}, 
    doctorName: {type:String}
}); 

module.exports = mongoose.model("MedicalReport", MedicalReportSchema) ;
