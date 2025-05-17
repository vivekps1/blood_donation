const mongoose = require("mongoose") ; 

const NotificationSchema = mongoose.Schema({
    notificationId : {type:String}, 
    userId: {type:String}, 
    adminId: {type:String}, 
    requestId: {type:String}, 
    requestStatus: {type:String}, 
    notificationType: {type:String}, 
    message :{type:String}, 
    sentAt : {type:Date}, 
    isRead : {type:Boolean, default:false}
});

module.exports = mongoose.model("Notification", NotificationSchema)