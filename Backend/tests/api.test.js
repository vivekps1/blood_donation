const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// These tests exercise the HTTP layer — routing, security headers, authentication and
// request validation — all of which run before any handler touches the database. They
// therefore need no MongoDB instance, which keeps them runnable in CI and as part of the
// Testing and QA task in the project plan.
//
// JWT_SEC must be set before app.js is required, since the auth middleware reads it.
process.env.JWT_SEC = process.env.JWT_SEC || 'test-secret-for-unit-tests';
process.env.DISABLE_JOBS = 'true';

// No database is connected, so Mongoose buffers any query until it times out. The default
// is 10 seconds per query, which would make this suite take minutes. The handful of
// assertions that deliberately reach the data layer only need to know they got that far.
require('mongoose').set('bufferTimeoutMS', 250);

const app = require('../app');
const jwt = require('jsonwebtoken');

let server;
let baseUrl;

test.before(async () => {
    await new Promise((resolve) => {
        // Port 0 asks the OS for any free port, so the tests cannot collide with a running server.
        server = app.listen(0, () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
});

// Minimal HTTP client so the tests add no dependency.
const request = (method, path, { body, token } = {}) => new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = token;

    const req = http.request(
        { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
        (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed = data;
                try { parsed = JSON.parse(data); } catch { /* not JSON; keep the raw text */ }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
});

const tokenFor = (roleId) => jwt.sign({ userId: '000000000000000000000001', roleId }, process.env.JWT_SEC);

// ---------------------------------------------------------------------------

test('the health endpoint answers without authentication', async () => {
    const res = await request('GET', '/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
});

test('an unknown route returns a JSON 404 rather than an HTML error page', async () => {
    const res = await request('GET', '/api/v1/does-not-exist');
    assert.strictEqual(res.status, 404);
    assert.match(res.body.message, /No route matches/);
});

test('security headers are set on every response', async () => {
    const res = await request('GET', '/health');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'DENY');
    assert.ok(res.headers['content-security-policy']);
    // Express advertises itself by default; that is removed.
    assert.strictEqual(res.headers['x-powered-by'], undefined);
});

test('rate limit headers are present on API routes', async () => {
    const res = await request('GET', '/api/v1/roles');
    assert.ok(res.headers['x-ratelimit-limit'], 'expected a rate limit budget to be advertised');
});

// --- Authentication --------------------------------------------------------

test('protected routes reject an anonymous caller', async () => {
    // Every one of these was reachable without a token, or without the right role, before
    // this release; /api/v1/users did not exist at all.
    const protectedRoutes = [
        ['GET', '/api/v1/users'],
        ['GET', '/api/v1/donors'],
        ['GET', '/api/v1/donation-requests'],
        ['GET', '/api/v1/medical-reports'],
        ['GET', '/api/v1/inventory'],
        ['GET', '/api/v1/reports/summary'],
        ['GET', '/api/v1/notifications'],
        ['GET', '/api/v1/hospitals'],
        ['POST', '/api/v1/user-profile']
    ];

    for (const [method, path] of protectedRoutes) {
        const res = await request(method, path);
        assert.strictEqual(res.status, 401, `${method} ${path} should require authentication, got ${res.status}`);
    }
});

test('an invalid token is rejected', async () => {
    const res = await request('GET', '/api/v1/users', { token: 'Bearer not-a-real-token' });
    assert.strictEqual(res.status, 403);
});

test('role creation now requires authentication', async () => {
    // This endpoint previously had no auth at all: anyone could POST a role with every
    // permission flag set and then be assigned to it.
    const res = await request('POST', '/api/v1/roles', { body: { roleId: 99, userRole: 'superuser', manageUsers: true } });
    assert.strictEqual(res.status, 401);
});

// --- Validation ------------------------------------------------------------

test('registration rejects a malformed body before reaching the database', async () => {
    const res = await request('POST', '/api/v1/auth/register', {
        body: { firstName: 'Test', email: 'not-an-email', phoneNumber: 'abc', bloodGroup: 'Z+', password: 'x' }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'Validation failed');
    assert.ok(res.body.errors.email, 'the email format should be rejected');
    assert.ok(res.body.errors.phoneNumber, 'the phone format should be rejected');
    assert.ok(res.body.errors.bloodGroup, 'an unknown blood group should be rejected');
});

test('registration accepts a well-formed body (and only then reaches the database)', async () => {
    const res = await request('POST', '/api/v1/auth/register', {
        body: {
            firstName: 'Test', lastName: 'Donor', email: 'test.donor@example.com',
            phoneNumber: '+919847099465', bloodGroup: 'O+', password: 'Passw0rd123'
        }
    });
    // Validation passed, so this is no longer a 400. Without a database the handler fails
    // later, which is exactly the boundary this test is pinning down.
    assert.notStrictEqual(res.status, 400, 'a valid body must pass validation');
});

test('login requires an email and a password', async () => {
    const res = await request('POST', '/api/v1/auth/login', { body: { email: 'someone@example.com' } });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.errors.password);
});

test('password reset requires all three fields', async () => {
    const res = await request('POST', '/api/v1/auth/reset-password', { body: { email: 'a@b.com' } });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.errors.token);
    assert.ok(res.body.errors.newPassword);
});

// --- Route ordering --------------------------------------------------------

test('literal paths are not captured by their sibling ":id" routes', async () => {
    // /hospitals/stats and /donation/history/stats were previously registered after
    // "/:id", so they were answered by the parameter route and failed as a cast error.
    // With a token they now reach their own handler; the assertion here is only that they
    // are not treated as an id lookup.
    const token = tokenFor(0);
    for (const path of ['/api/v1/hospitals/stats', '/api/v1/donation-requests/open-for-me']) {
        const res = await request('GET', path, { token });
        assert.notStrictEqual(res.status, 404, `${path} should resolve to its own handler`);
        assert.notStrictEqual(res.status, 401, `${path} should accept a valid token`);
    }
});
