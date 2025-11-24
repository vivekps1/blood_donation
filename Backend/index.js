const app = require("./app") ; 
const dotenv = require("dotenv") ; 
const mongoose = require("mongoose") ;
const dbConnection = require("./utils/db");


dotenv.config() ; 

//PORT 
const PORT = process.env.PORT ;

// Start DB connection first, then start the server when DB is ready
const start = async () => {
    try {
        await dbConnection();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err.message || err);
        process.exit(1);
    }
};

start();