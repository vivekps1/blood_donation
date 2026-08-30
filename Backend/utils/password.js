// Password hashing.
//
// Synopsis section 10 claims "data encryption" and role-based protection of credentials.
// The original implementation stored passwords with reversible AES (crypto-js) under a
// single shared key, which means anyone with the key — or a copy of the .env file —
// recovers every password in plain text.
//
// Passwords are now stored as scrypt hashes (one-way, salted, memory-hard) using Node's
// built-in crypto, so no additional dependency is introduced. Existing AES records keep
// working and are transparently re-hashed the next time their owner logs in, so the
// change needs no downtime or forced password reset.

const crypto = require('crypto');
const CryptoJs = require('crypto-js');

const SCRYPT_PREFIX = 'scrypt$';
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
// Cost parameters. N must be a power of two; 16384 is the Node default and keeps a hash
// at roughly 100ms on typical hardware.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const scryptAsync = (password, salt) => new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
    });
});

// Produce a self-describing hash: scrypt$N$r$p$salt$key
const hashPassword = async (plainPassword) => {
    if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
        throw new Error('Password must be a non-empty string');
    }
    const salt = crypto.randomBytes(SALT_BYTES);
    const derivedKey = await scryptAsync(plainPassword, salt);
    const { N, r, p } = SCRYPT_PARAMS;
    return `${SCRYPT_PREFIX}${N}$${r}$${p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
};

const isLegacyHash = (stored) => typeof stored === 'string' && !stored.startsWith(SCRYPT_PREFIX);

// Legacy verification path: decrypt the AES blob and compare. Only reached for accounts
// that have not logged in since the migration.
const verifyLegacy = (plainPassword, stored) => {
    try {
        const decrypted = CryptoJs.AES.decrypt(stored, process.env.PASS).toString(CryptoJs.enc.Utf8);
        if (!decrypted) return false;
        // Compare in constant time to avoid leaking prefix information.
        const a = Buffer.from(decrypted);
        const b = Buffer.from(plainPassword);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (e) {
        return false;
    }
};

// Returns { valid, needsRehash }. When needsRehash is true the caller should persist a
// fresh hashPassword() result for the user.
const verifyPassword = async (plainPassword, stored) => {
    if (!stored || typeof plainPassword !== 'string') return { valid: false, needsRehash: false };

    if (isLegacyHash(stored)) {
        return { valid: verifyLegacy(plainPassword, stored), needsRehash: true };
    }

    const parts = stored.split('$');
    // scrypt, N, r, p, salt, key
    if (parts.length !== 6) return { valid: false, needsRehash: false };
    const [, N, r, p, saltHex, keyHex] = parts;

    try {
        const salt = Buffer.from(saltHex, 'hex');
        const expected = Buffer.from(keyHex, 'hex');
        const derivedKey = await new Promise((resolve, reject) => {
            crypto.scrypt(plainPassword, salt, expected.length,
                { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
                (err, key) => (err ? reject(err) : resolve(key)));
        });
        const valid = derivedKey.length === expected.length && crypto.timingSafeEqual(derivedKey, expected);
        return { valid, needsRehash: false };
    } catch (e) {
        return { valid: false, needsRehash: false };
    }
};

// Password policy, enforced on register / change / reset.
const MIN_PASSWORD_LENGTH = 8;
const validatePasswordStrength = (password) => {
    const errors = [];
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }
    if (typeof password === 'string') {
        if (!/[A-Za-z]/.test(password)) errors.push('Password must contain at least one letter');
        if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    }
    return { valid: errors.length === 0, errors };
};

// Short numeric code for SMS/email verification, and opaque tokens for password reset.
const generateNumericCode = (digits = 6) => {
    const max = 10 ** digits;
    return String(crypto.randomInt(0, max)).padStart(digits, '0');
};
const generateToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = {
    hashPassword,
    verifyPassword,
    isLegacyHash,
    validatePasswordStrength,
    MIN_PASSWORD_LENGTH,
    generateNumericCode,
    generateToken,
    hashToken
};
