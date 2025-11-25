const mongoose = require("mongoose") ; 

const UserSchema = mongoose.Schema({
    firstName:{type:String, require:true},
    lastName:{type:String, require:true},
    email:{type:String, require:true}, 
    phoneNumber:{type:String, require:true}, 
    password:{type:String, require:true}, 
    bloodGroup:{type:String, require:true}, 
    dateofBirth:{type:Date, require:true}, 
    address:{type:String},
    height: { type: Number },
    weight: { type: Number },
    photo: { type: String },
    locationName: { type: String },
    locationGeo: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: { type: [Number], default: void 0 }
    },
    isActive:{type:Number, default:0}, 
    roleId:{type:Number, default:1}, 
},
{
    timestamps: true
})

// Create 2dsphere index for locationGeo if not exists
UserSchema.index({ locationGeo: '2dsphere' });
module.exports = mongoose.model("User", UserSchema)