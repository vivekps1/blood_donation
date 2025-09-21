const mongoose = require("mongoose") ;

const RolesSchema = mongoose.Schema({
    roleId : {type:Number}, 
    userRole : {type:String, default:"donor"}, 
    manageUsers: {type:Boolean, default:false}, 
    manageHospitals: {type:Boolean,default:false}, 
    manageDonationRequests: {type:Boolean, default:false}, 
    viewReports: {type:Boolean, default:true}, 
    generateNotifications: {type:Boolean, default:false}, 
    accessLevel: {type:String}, 
    description:{type:String} 
});


module.exports = mongoose.model("Roles", RolesSchema) ;