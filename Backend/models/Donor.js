const mongoose = require("mongoose") ;

const DonorSchema = mongoose.Schema({
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    name:{type:String, require:true}, 
    email:{type:String, require:true}, 
    address:{type:String},
    phoneNumber: {type:String, require:true}, 
    bloodGroup:{type:String, require:true}, 
    height:{type:String, require:true},
    weight:{type:String, require:true}, 
    date: {type:String, require:true}, 
    dateofBirth:{type:Date},
    diseases: {type:String, default:"No"}, 
    age: {type:Number, require:true}, 
    bloodPressure:{type:Number, require:true}, 
    status:{type:Number, default:0}
}, { timestamps: true })

module.exports = mongoose.model("Donor", DonorSchema) ;