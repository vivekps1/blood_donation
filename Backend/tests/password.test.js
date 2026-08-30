const test = require('node:test');
const assert = require('node:assert');
const password = require('../utils/password');

test('a hash verifies against its own password and nothing else', async () => {
    const hash = await password.hashPassword('CorrectHorse9');
    assert.ok(hash.startsWith('scrypt$'));
    assert.strictEqual((await password.verifyPassword('CorrectHorse9', hash)).valid, true);
    assert.strictEqual((await password.verifyPassword('correcthorse9', hash)).valid, false);
    assert.strictEqual((await password.verifyPassword('', hash)).valid, false);
});

test('the same password hashes differently each time (salted)', async () => {
    const a = await password.hashPassword('Repeated123');
    const b = await password.hashPassword('Repeated123');
    assert.notStrictEqual(a, b);
    assert.strictEqual((await password.verifyPassword('Repeated123', a)).valid, true);
    assert.strictEqual((await password.verifyPassword('Repeated123', b)).valid, true);
});

test('the plaintext password never appears in the stored hash', async () => {
    const hash = await password.hashPassword('SuperSecret1');
    assert.ok(!hash.includes('SuperSecret1'));
});

test('legacy AES records still authenticate and are flagged for re-hashing', async () => {
    process.env.PASS = 'legacy-test-key';
    const CryptoJs = require('crypto-js');
    const legacy = CryptoJs.AES.encrypt('OldPassword1', process.env.PASS).toString();

    const good = await password.verifyPassword('OldPassword1', legacy);
    assert.strictEqual(good.valid, true);
    assert.strictEqual(good.needsRehash, true, 'a legacy record must be marked for upgrade');

    const bad = await password.verifyPassword('WrongPassword1', legacy);
    assert.strictEqual(bad.valid, false);
});

test('a malformed stored hash is rejected rather than throwing', async () => {
    for (const stored of ['scrypt$broken', 'scrypt$1$2$3$4$5$6', null, undefined]) {
        const result = await password.verifyPassword('anything', stored);
        assert.strictEqual(result.valid, false);
    }
});

test('the password policy requires length, a letter and a number', () => {
    assert.strictEqual(password.validatePasswordStrength('Passw0rd').valid, true);
    assert.strictEqual(password.validatePasswordStrength('short1').valid, false);
    assert.strictEqual(password.validatePasswordStrength('nodigitshere').valid, false);
    assert.strictEqual(password.validatePasswordStrength('12345678').valid, false);
    assert.strictEqual(password.validatePasswordStrength(undefined).valid, false);
});

test('verification codes and reset tokens are the right shape and unpredictable', () => {
    const codes = new Set();
    for (let i = 0; i < 200; i++) {
        const code = password.generateNumericCode(6);
        assert.match(code, /^\d{6}$/);
        codes.add(code);
    }
    // 200 draws from 10^6 should essentially never collide into a tiny set.
    assert.ok(codes.size > 190, `expected near-unique codes, got ${codes.size} distinct of 200`);

    assert.match(password.generateToken(16), /^[0-9a-f]{32}$/);
    // Hashing a token is deterministic, which is what lets us store only the hash.
    assert.strictEqual(password.hashToken('abc'), password.hashToken('abc'));
    assert.notStrictEqual(password.hashToken('abc'), password.hashToken('abd'));
});
