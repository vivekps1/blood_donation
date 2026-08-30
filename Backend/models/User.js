const mongoose = require("mongoose") ;

// Per-user delivery preferences, consumed by utils/notify.js ("prioritizing user
// preferences and implementing intelligent routing", synopsis section 9.b.5).
const NotificationPreferencesSchema = new mongoose.Schema({
    email: { type: Boolean, default: true },
    // SMS defaults to urgent-only rather than off; utils/notify.js decides per event.
    sms: { type: Boolean, default: undefined },
    app: { type: Boolean, default: true }
}, { _id: false });

const UserSchema = mongoose.Schema({
    firstName:{type:String, required:true},
    lastName:{type:String, required:true},
    email:{type:String, required:true, unique:true, lowercase:true, trim:true},
    phoneNumber:{type:String, required:true, unique:true, trim:true},
    password:{type:String, required:true},
    bloodGroup:{type:String, required:true},
    dateofBirth:{type:Date},
    address:{type:String},
    height: { type: Number },
    weight: { type: Number },
    photo: { type: String },
    locationName: { type: String },

    // Fixed: this was previously declared as `{ type: String, coordinates: [Number] }`,
    // which Mongoose reads as a plain String path — the nested coordinates were silently
    // discarded and every $near query against it matched nothing. It is now a real
    // GeoJSON point, matching UserProfile.
    locationGeo: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: { type: [Number], default: void 0 }
    },

    // Account state. `isActive` gates sign-in and is controlled by administrators
    // (synopsis 9.b.4, "review new registrations"); `isVerified` records that the user
    // confirmed the code sent to their email/phone at registration (synopsis 9.b.1).
    isActive:{type:Boolean, default:true},
    isVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    phoneVerifiedAt: { type: Date },
    // Hashed, never the raw code.
    verificationCodeHash: { type: String, select: false },
    verificationExpires: { type: Date, select: false },
    verificationAttempts: { type: Number, default: 0, select: false },

    // Self-service password reset (synopsis section 10, "Users can manage their own
    // security by changing their passwords").
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: { type: Date },

    // Referral programme: "Users can also generate invitation links to expand the donor
    // network through referrals" (synopsis 9.b.1).
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },

    notificationPreferences: { type: NotificationPreferencesSchema, default: () => ({}) },

    // Hospital staff accounts are bound to the hospital they act for.
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

    lastLoginAt: { type: Date },
    roleId:{type:Number, default:1},
},
{
    timestamps: true
})

UserSchema.index({ locationGeo: '2dsphere' });

module.exports = mongoose.model("User", UserSchema)
