const mongoose = require("mongoose") ;

const UserProfileSchema = mongoose.Schema({
    profileId : {type:Number} ,
    // store a reference to the User document using ObjectId
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    address: {type:String}, 
    city: {type:String}, 
    state: {type:String}, 
    country: {type:String}, 
    pincode: {type:String}, 
    photo: { type: String },
    locationGeo: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: { type: [Number], default: void 0 }
    },
    locationName: { type: String },
    height: {type:Number, require:true}, 
    weight: {type:Number, require:true},
    medicalHistory: {type:String}, 
    lastDonationDate: {type:Date}, 
    donorStatus: {type:Boolean, default:false} 
})

// create 2dsphere index on locationGeo to support geospatial queries
UserProfileSchema.index({ locationGeo: '2dsphere' });

module.exports = mongoose.model("UserProfile", UserProfileSchema) ;