const dotenv = require("dotenv") ; 
const mongoose = require("mongoose") ; 

dotenv.config() ;

//DB 
const DB = process.env.DB ;


const dbConnection = async() =>{
    try{

        await mongoose.connect(DB).then(() =>{
            console.log("Database Connected Successfully") ;
        }) ;   
    }catch (err){
        console.log(err) ; 
        setTimeout(dbConnection, 5000) ;
    }
}

module.exports=dbConnection ;