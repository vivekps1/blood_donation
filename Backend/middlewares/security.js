// Baseline HTTP hardening.
//
// Synopsis section 10 claims counter-measures against "loss of availability, loss of
// integrity, and loss of confidentiality". Nothing in the original server implemented any
// of them. These middlewares are deliberately dependency-free so the project's stated
// tool list stays accurate.

// Security response headers (the subset of helmet's defaults that matter for a JSON API
// serving an uploads directory).
const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    // Uploaded medical reports must never be executed or framed by a third party.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox");
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.removeHeader('X-Powered-By');
    next();
};

// Fixed-window in-memory rate limiter. Adequate for the single-process deployment the
// synopsis describes (section 4, one Ubuntu server); a multi-process deployment would
// need a shared store.
const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 100, keyPrefix = '', message } = {}) => {
    const hits = new Map();

    // Drop expired windows periodically so the map cannot grow without bound.
    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs);
    // Do not hold the event loop open on shutdown.
    if (typeof sweep.unref === 'function') sweep.unref();

    return (req, res, next) => {
        const key = keyPrefix + (req.ip || req.connection?.remoteAddress || 'unknown');
        const now = Date.now();
        let entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count++;

        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader('Retry-After', retryAfter);
            return res.status(429).json({
                message: message || 'Too many requests. Please try again later.',
                retryAfterSeconds: retryAfter
            });
        }
        next();
    };
};

// Credential endpoints get a much tighter budget than ordinary reads, to blunt
// password guessing and verification-code brute force.
const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyPrefix: 'auth:',
    message: 'Too many authentication attempts. Please try again in a few minutes.'
});

const apiLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyPrefix: 'api:'
});

// Final error handler. Express 5 forwards async rejections here; without it, a thrown
// error leaked a stack trace to the client.
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('[error]', req.method, req.originalUrl, err && (err.stack || err.message || err));

    // Multer rejects oversized or disallowed uploads with a code.
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The uploaded file is too large' });
    }
    if (err && /Only .* files are allowed/.test(String(err.message))) {
        return res.status(415).json({ message: err.message });
    }
    if (err && err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
    }
    if (err && err.name === 'CastError') {
        return res.status(400).json({ message: `Invalid value for ${err.path}` });
    }

    const status = err && err.status ? err.status : 500;
    res.status(status).json({
        message: status === 500 ? 'Internal server error' : (err.message || 'Request failed')
    });
};

const notFoundHandler = (req, res) => {
    res.status(404).json({ message: `No route matches ${req.method} ${req.originalUrl}` });
};

module.exports = { securityHeaders, createRateLimiter, authLimiter, apiLimiter, errorHandler, notFoundHandler };
