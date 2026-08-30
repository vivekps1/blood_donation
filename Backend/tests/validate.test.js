const test = require('node:test');
const assert = require('node:assert');
const { validateBody, rules } = require('../middlewares/validate');

// Minimal express double: capture the status and body a middleware responds with.
const runMiddleware = (middleware, body) => {
    let response = null;
    let nextCalled = false;
    const res = {
        status(code) { response = { status: code }; return res; },
        json(payload) { response.body = payload; return res; }
    };
    middleware({ body }, res, () => { nextCalled = true; });
    return { response, nextCalled };
};

test('a valid body passes straight through', () => {
    const mw = validateBody({ email: ['required', 'email'], bloodGroup: ['required', 'bloodGroup'] });
    const { nextCalled, response } = runMiddleware(mw, { email: 'a@b.com', bloodGroup: 'O+' });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(response, null);
});

test('missing required fields are reported per field', () => {
    const mw = validateBody({ email: ['required'], phoneNumber: ['required'] });
    const { nextCalled, response } = runMiddleware(mw, {});
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(response.status, 400);
    assert.ok(response.body.errors.email);
    assert.ok(response.body.errors.phoneNumber);
});

test('email and phone formats are checked', () => {
    const mw = validateBody({ email: ['email'], phoneNumber: ['phone'] });
    assert.strictEqual(runMiddleware(mw, { email: 'not-an-email' }).nextCalled, false);
    assert.strictEqual(runMiddleware(mw, { email: 'valid@example.com' }).nextCalled, true);
    assert.strictEqual(runMiddleware(mw, { phoneNumber: '+919847099465' }).nextCalled, true);
    assert.strictEqual(runMiddleware(mw, { phoneNumber: '98470 99465' }).nextCalled, true);
    assert.strictEqual(runMiddleware(mw, { phoneNumber: '123' }).nextCalled, false);
    assert.strictEqual(runMiddleware(mw, { phoneNumber: 'not a phone' }).nextCalled, false);
});

test('blood group validation shares the compatibility module rules', () => {
    const mw = validateBody({ bloodGroup: ['bloodGroup'] });
    assert.strictEqual(runMiddleware(mw, { bloodGroup: 'AB-' }).nextCalled, true);
    assert.strictEqual(runMiddleware(mw, { bloodGroup: 'o positive' }).nextCalled, true);
    assert.strictEqual(runMiddleware(mw, { bloodGroup: 'C+' }).nextCalled, false);
});

test('unit counts must be whole positive numbers', () => {
    const mw = validateBody({ bloodUnitsCount: ['required', 'positiveInt'] });
    assert.strictEqual(runMiddleware(mw, { bloodUnitsCount: 3 }).nextCalled, true);
    assert.strictEqual(runMiddleware(mw, { bloodUnitsCount: 0 }).nextCalled, false);
    assert.strictEqual(runMiddleware(mw, { bloodUnitsCount: -2 }).nextCalled, false);
    assert.strictEqual(runMiddleware(mw, { bloodUnitsCount: 1.5 }).nextCalled, false);
});

test('a required-by date cannot be in the past', () => {
    const mw = validateBody({ requiredDate: ['futureDate'] });
    const tomorrow = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const lastYear = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    assert.strictEqual(runMiddleware(mw, { requiredDate: tomorrow }).nextCalled, true);
    assert.strictEqual(runMiddleware(mw, { requiredDate: lastYear }).nextCalled, false);
    // An absent optional field is fine.
    assert.strictEqual(runMiddleware(mw, {}).nextCalled, true);
});

test('oneOf and maxLength behave as expected', () => {
    const mw = validateBody({
        priority: [rules.oneOf(['Normal', 'Urgent', 'Critical'])],
        patientName: [rules.maxLength(10)]
    });
    assert.strictEqual(runMiddleware(mw, { priority: 'urgent' }).nextCalled, true, 'matching is case-insensitive');
    assert.strictEqual(runMiddleware(mw, { priority: 'Whenever' }).nextCalled, false);
    assert.strictEqual(runMiddleware(mw, { patientName: 'Short' }).nextCalled, true);
    assert.strictEqual(runMiddleware(mw, { patientName: 'A very long patient name' }).nextCalled, false);
});
