const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

const { securityHeaders, apiLimiter, errorHandler, notFoundHandler } = require("./middlewares/security");

// Routes
const authRoute = require("./routes/auth");
const userRoute = require("./routes/user");
const donorRoute = require("./routes/donor");
const hospitalRoute = require("./routes/hospital");
const roleRoute = require("./routes/role");
const donationHistoryRoute = require("./routes/donationHistory");
const donationHistoryAggregateRoute = require("./routes/donationHistoryAggregate");
const donationRequestRoute = require("./routes/donationRequest");
const notificationRoute = require("./routes/notification");
const userProfileRoute = require("./routes/userProfile");
const medicalReportRoute = require("./routes/medicalReport");
const bloodInventoryRoute = require("./routes/bloodInventory");
const reportRoute = require("./routes/report");
const statsRoute = require("./routes/stats");

// Behind a reverse proxy, req.ip must come from X-Forwarded-For or the rate limiter
// would key every request to the proxy's own address.
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

// CORS. Restricted to the configured frontend origin in production; the previous
// `cors()` with no options allowed any site on the internet to call the API with a
// user's credentials.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // Same-origin and server-to-server calls arrive with no Origin header.
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not permitted`));
    },
    credentials: true
}));

app.use(securityHeaders);

// Cap the JSON body size so a single request cannot exhaust server memory.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api', apiLimiter);

// Health check, useful for the deployment step in the project plan.
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', time: new Date() }));

// ROUTES
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/donors", donorRoute);
app.use("/api/v1/hospitals", hospitalRoute);
app.use("/api/v1/roles", roleRoute);

// The aggregate route must be mounted before the generic donation-history route so that
// /aggregate is not captured by the latter's "/:id" parameter route.
app.use('/api/v1/donation/history', donationHistoryAggregateRoute);
app.use("/api/v1/donation/history", donationHistoryRoute);

app.use('/api/v1/donation-requests', donationRequestRoute);
app.use('/api/v1/medical-reports', medicalReportRoute);
app.use('/api/v1/inventory', bloodInventoryRoute);
app.use('/api/v1/reports', reportRoute);
app.use('/api/v1/notifications', notificationRoute);
app.use('/api/v1/user-profile', userProfileRoute);
app.use('/api/v1/stats', statsRoute);

// Uploaded files: profile photos and medical reports. Served with nosniff and no
// inline rendering, so an uploaded document cannot execute in a viewer's browser.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
}));

// ERROR HANDLERS — must be registered last.
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
