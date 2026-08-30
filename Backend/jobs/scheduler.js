// Scheduled background work.
//
// Two of the workflows in the synopsis are time-driven rather than request-driven:
//  * "generating personalized notifications when ... a user becomes eligible to donate"
//    (section 9.b.5) — nothing triggers this except the passage of time.
//  * Blood has a shelf life, so stock has to be retired when it expires for the inventory
//    to stay "real-time" in any meaningful sense.
//
// Both are plain intervals rather than a cron dependency, which keeps the declared tool
// list in section 4 accurate. Set DISABLE_JOBS=true to turn them off (useful in tests).

const inventory = require('../utils/inventory');
const notificationController = require('../controllers/notification');

const HOUR_MS = 60 * 60 * 1000;
const timers = [];

// Run a job now and then on an interval, logging rather than throwing so a failing job
// can never take the server down.
const schedule = (name, intervalMs, fn) => {
    const run = async () => {
        try {
            const result = await fn();
            console.log(`[job:${name}]`, result);
        } catch (err) {
            console.error(`[job:${name}] failed:`, err.message || err);
        }
    };
    const timer = setInterval(run, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    timers.push(timer);
    // Stagger the first run so startup is not blocked by background work.
    setTimeout(run, 30 * 1000).unref?.();
};

const start = () => {
    if (process.env.DISABLE_JOBS === 'true') {
        console.log('[jobs] background jobs disabled by DISABLE_JOBS');
        return;
    }

    // Tell donors whose 90-day window has just closed that they can give again.
    schedule('eligibility-sweep', 24 * HOUR_MS, async () => {
        // Reuse the controller logic by calling it with a minimal request/response pair,
        // so the scheduled path and the admin-triggered path cannot drift apart.
        return new Promise((resolve, reject) => {
            const res = { status: () => res, json: resolve };
            notificationController.runEligibilitySweep({ body: { windowDays: 1 } }, res, reject);
        });
    });

    // Retire stock past its shelf life.
    schedule('inventory-expiry', 12 * HOUR_MS, async () => {
        const expired = await inventory.expireStock();
        return `${expired.length} batch(es) expired`;
    });

    console.log('[jobs] eligibility sweep and inventory expiry scheduled');
};

const stop = () => {
    timers.forEach(clearInterval);
    timers.length = 0;
};

module.exports = { start, stop };
