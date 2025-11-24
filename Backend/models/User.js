const mongoose = require("mongoose") ; 

const UserSchema = mongoose.Schema({
    firstName:{type:String, require:true},
    lastName:{type:String, require:true},
    userName:{type:String, require:true}, 
    email:{type:String, require:true}, 
    phoneNumber:{type:String, require:true}, 
    password:{type:String, require:true}, 
    bloodGroup:{type:String, require:true}, 
    dateofBirth:{type:Date, require:true}, 
    height: { type: Number },
    weight: { type: Number },
    isActive:{type:Number, default:0}, 
    roleId:{type:Number, default:1}, 
},
{
    timestamps: true
})

module.exports = mongoose.model("User", UserSchema)