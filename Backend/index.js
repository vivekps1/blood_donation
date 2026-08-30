const app = require("./app");
const dotenv = require("dotenv");
const dbConnection = require("./utils/db");
const { seedRoles } = require("./controllers/role");
const jobs = require("./jobs/scheduler");

dotenv.config();

const PORT = process.env.PORT || 8000;

// Fail fast on missing secrets rather than starting a server that will reject every
// request with an opaque JWT error.
const REQUIRED_ENV = ['DB', 'JWT_SEC'];

const start = async () => {
    const missing = REQUIRED_ENV.filter(key => !process.env[key]);
    if (missing.length) {
        console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
        process.exit(1);
    }

    try {
        await dbConnection();

        // The permission model is what authorization reads on every request, so the roles
        // it depends on are seeded at startup. Seeding is idempotent and never revokes a
        // permission an administrator has customised.
        const seeded = await seedRoles();
        console.log('Roles ready:', seeded.map(r => `${r.userRole}(${r.action})`).join(', '));

        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            jobs.start();
        });

        // Finish in-flight requests before exiting, so a deploy cannot truncate a write.
        const shutdown = (signal) => {
            console.log(`${signal} received, shutting down`);
            jobs.stop();
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(1), 10000).unref();
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
        console.error('Failed to start server:', err.message || err);
        process.exit(1);
    }
};

start();
