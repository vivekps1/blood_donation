const express = require("express") ; 
const cors = require("cors") ;
const app = express() ;  
const authRoute = require("./routes/auth") ;
const donorRoute = require("./routes/donor") ;
const hospitalRoute = require("./routes/hospital") ;
const roleRoute = require("./routes/role") ; 
// const requestRoute = require("./routes/request") ;
const donationHistoryRoute = require("./routes/donationHistory") ;
const notificationRoute = require("./routes/notification") ;
const donationHistoryAggregateRoute = require("./routes/donationHistoryAggregate") ;
const donationRequestRoute = require("./routes/donationRequest") ;
const statsRoute = require("./routes/stats");
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
// IMPORTANT: Mount the aggregate route BEFORE the generic donationHistoryRoute so that
// /aggregate isn't intercepted by the "/:id" route inside donationHistoryRoute.
app.use('/api/v1/donation/history', donationHistoryAggregateRoute);
app.use('/api/v1/donation-requests', donationRequestRoute);
app.use('/api/v1/stats', statsRoute);
// Serve uploaded files (profile pics)
const path = require('path');
app.use('/uploads', require('express').static(path.join(__dirname, 'uploads')));

const userProfileRoute = require("./routes/userProfile");
app.use('/api/v1/user-profile', userProfileRoute);

app.use("/api/v1/donation/history", donationHistoryRoute) ;
app.use("/api/v1/notifications", notificationRoute) ; 
// app.use("/api/v1/reports", reportRoute) ;
// app.use("/api/v1/users", userRoute) ;
// ERROR HANDLER    

module.exports = app;