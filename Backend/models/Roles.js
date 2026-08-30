const mongoose = require("mongoose") ;

// tb_roles_and_permission from the synopsis (section 8).
//
// These flags are now read by middlewares/permissions.js. Previously nothing consulted
// them: authorization was a hard-coded `roleId === 0` check, so the table existed but
// described nothing the system actually did.

const RolesSchema = mongoose.Schema({
    roleId : {type:Number, unique: true, index: true},
    userRole : {type:String, default:"donor", unique: true},

    // Permission to manage user accounts.
    manageUsers: {type:Boolean, default:false},
    // Permission to manage hospital records (and, by extension, their blood stock).
    manageHospitals: {type:Boolean,default:false},
    // Permission to approve, reject, close and match donation requests.
    manageDonationRequests: {type:Boolean, default:false},
    // Permission to read and file medical reports for other people
    // (tb_roles_and_permission.view_medical_reports). Reading one's own report never
    // requires this — the controllers scope those reads to the caller.
    viewMedicalReports: {type:Boolean, default:false},
    // Permission to run the organisation-wide reports in the Reports module.
    viewReports: {type:Boolean, default:false},
    // Permission to broadcast notifications.
    generateNotifications: {type:Boolean, default:false},

    accessLevel: {type:String},
    description:{type:String}
});

module.exports = mongoose.model("Roles", RolesSchema) ;
