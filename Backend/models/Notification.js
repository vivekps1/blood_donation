const mongoose = require("mongoose") ;

// Per-channel delivery outcome, so the Notification module can report on
// "notification delivery and engagement" as required by synopsis section 9.b.5.
const DeliverySchema = new mongoose.Schema({
    status: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    sentAt: { type: Date },
    error: { type: String }
}, { _id: false });

const NotificationSchema = mongoose.Schema({
    notificationId : {type:String},
    userId: {type:String, index: true},
    adminId: {type:String},
    requestId: {type:String},
    requestStatus: {type:String},
    notificationType: {type:String},
    // Event that produced this notification (REQUEST_CREATED, DONOR_MATCHED, ...).
    // Lets the UI group/filter and lets us avoid sending the same event twice.
    category: {type:String, index: true},
    title: {type:String},
    message :{type:String},
    // Channels this notification was dispatched over. 'app' is always implied.
    channels: {type:[String], default: ['app']},
    delivery: {
        email: { type: DeliverySchema, default: () => ({ status: 'skipped' }) },
        sms: { type: DeliverySchema, default: () => ({ status: 'skipped' }) }
    },
    // Free-form payload the frontend uses to deep-link (e.g. { requestId, hospitalId }).
    meta: { type: mongoose.Schema.Types.Mixed },
    sentAt : {type:Date, default: Date.now},
    isRead : {type:Boolean, default:false},
    readAt: {type:Date}
}, { timestamps: true });

// Notification lists are always "newest first for one user".
NotificationSchema.index({ userId: 1, sentAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema)
