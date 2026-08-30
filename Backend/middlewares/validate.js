// Request body validation.
//
// Synopsis section 5 lists "Data Inconsistency and Corruption" as a defect of the system
// being replaced, and section 10 promises integrity counter-measures. Handlers previously
// wrote req.body straight into Mongoose, so a malformed payload became a malformed
// document. These helpers reject bad input at the edge with a field-level error map the
// frontend can render inline.

const { BLOOD_GROUPS, normalize } = require('../utils/bloodCompatibility');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Accepts an optional +country prefix and 7-15 digits.
const PHONE_RE = /^\+?[0-9]{7,15}$/;

const rules = {
    required: (value) => (value === undefined || value === null || String(value).trim() === '')
        ? 'is required' : null,
    email: (value) => (value && !EMAIL_RE.test(String(value).trim())) ? 'must be a valid email address' : null,
    phone: (value) => (value && !PHONE_RE.test(String(value).replace(/[\s-]/g, ''))) ? 'must be a valid phone number' : null,
    bloodGroup: (value) => (value && !normalize(value)) ? `must be one of ${BLOOD_GROUPS.join(', ')}` : null,
    positiveInt: (value) => {
        if (value === undefined || value === null || value === '') return null;
        const n = Number(value);
        return (!Number.isInteger(n) || n < 1) ? 'must be a whole number of at least 1' : null;
    },
    nonNegativeNumber: (value) => {
        if (value === undefined || value === null || value === '') return null;
        const n = Number(value);
        return (!Number.isFinite(n) || n < 0) ? 'must be zero or greater' : null;
    },
    date: (value) => (value && Number.isNaN(new Date(value).getTime())) ? 'must be a valid date' : null,
    // Guards against a required-by date in the past.
    futureDate: (value) => {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return 'must be a valid date';
        return d.getTime() < Date.now() - 24 * 60 * 60 * 1000 ? 'must not be in the past' : null;
    },
    oneOf: (allowed) => (value) => (value && !allowed.map(a => String(a).toUpperCase()).includes(String(value).toUpperCase()))
        ? `must be one of ${allowed.join(', ')}` : null,
    maxLength: (max) => (value) => (value && String(value).length > max) ? `must be at most ${max} characters` : null
};

// schema: { fieldName: [rule, rule, ...] }
// Each rule is a key of `rules` or a function (value, body) => errorString|null.
const validateBody = (schema) => (req, res, next) => {
    const errors = {};

    for (const [field, checks] of Object.entries(schema)) {
        const value = req.body ? req.body[field] : undefined;
        for (const check of checks) {
            const fn = typeof check === 'function' ? check : rules[check];
            if (!fn) continue;
            const problem = fn(value, req.body);
            if (problem) {
                errors[field] = `${field} ${problem}`;
                break; // one message per field keeps the UI readable
            }
        }
    }

    if (Object.keys(errors).length) {
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    next();
};

module.exports = { validateBody, rules };
