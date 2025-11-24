const dotenv = require("dotenv") ; 
const mongoose = require("mongoose") ; 

dotenv.config() ;

//DB 
const DB = process.env.DB ;


const dbConnection = async () => {
    try {
        if (!DB) {
            throw new Error('Missing DB connection string in environment variable DB');
        }

        // connect and wait for completion; modern mongoose uses sensible defaults
        await mongoose.connect(DB);
        console.log('Database Connected Successfully');
    } catch (err) {
        // log the actual error and retry connection after a short delay
        console.error('Database connection error:', err.message || err);
        setTimeout(dbConnection, 5000);
    }
};

module.exports=dbConnection ;