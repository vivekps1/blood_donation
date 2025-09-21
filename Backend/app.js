const express = require("express") ; 
const cors = require("cors") ;
const app = express() ;  
const authRoute = require("./routes/auth") ;
const donorRoute = require("./routes/donor") ;
const hospitalRoute = require("./routes/hospital") ;
const roleRoute = require("./routes/role") ;


module.exports = app ; 


//CORS 
app.use(cors()); 

//JSON 
app.use(express.json()) ;

// ROUTES 
app.use("/api/v1/auth", authRoute) ; 
app.use("/api/v1/donors", donorRoute)
app.use("/api/v1/hospitals", hospitalRoute)
app.use("/api/v1/roles", roleRoute)
// app.use("/api/v1/requests", requestRoute) ; 
// app.use("/api/v1/notifications", notificationRoute) ; 
// app.use("/api/v1/reports", reportRoute) ;
// app.use("/api/v1/users", userRoute) ;

// ERROR HANDLER    