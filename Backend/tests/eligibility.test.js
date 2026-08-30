const test = require('node:test');
const assert = require('node:assert');
const eligibility = require('../utils/eligibility');

const NOW = new Date('2026-08-29T00:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);
const healthyDonor = { age: 30, weight: '65', diseases: 'No', eligibility: 'eligible' };

test('the waiting period is the three months the synopsis specifies', () => {
    assert.strictEqual(eligibility.MIN_DAYS_BETWEEN_DONATIONS, 90);
});

test('a donor with no donation history is eligible', () => {
    const verdict = eligibility.evaluateDonor(healthyDonor, null, NOW);
    assert.strictEqual(verdict.eligible, true);
    assert.deepStrictEqual(verdict.reasons, []);
    assert.strictEqual(verdict.nextEligibleDate, null);
});

test('a donation inside the waiting period blocks the donor', () => {
    const verdict = eligibility.evaluateDonor(healthyDonor, daysAgo(30), NOW);
    assert.strictEqual(verdict.eligible, false);
    assert.strictEqual(verdict.daysUntilEligible, 60);
    assert.match(verdict.reasons[0], /60 day\(s\) remaining/);
});

test('the donor becomes eligible exactly at the boundary', () => {
    assert.strictEqual(eligibility.evaluateDonor(healthyDonor, daysAgo(89), NOW).eligible, false);
    assert.strictEqual(eligibility.evaluateDonor(healthyDonor, daysAgo(90), NOW).eligible, true);
    assert.strictEqual(eligibility.evaluateDonor(healthyDonor, daysAgo(200), NOW).eligible, true);
});

test('a medical block overrides an elapsed waiting period', () => {
    const verdict = eligibility.evaluateDonor(
        { ...healthyDonor, eligibility: 'ineligible' }, daysAgo(365), NOW);
    assert.strictEqual(verdict.eligible, false);
    assert.match(verdict.reasons[0], /medical assessment/);
});

test('declared conditions block, but "No" and its variants do not', () => {
    assert.strictEqual(eligibility.evaluateDonor({ ...healthyDonor, diseases: 'Diabetes' }, null, NOW).eligible, false);
    for (const value of ['No', 'no', 'None', 'nil', 'N/A', '']) {
        assert.strictEqual(eligibility.evaluateDonor({ ...healthyDonor, diseases: value }, null, NOW).eligible, true,
            `"${value}" should not be treated as a declared condition`);
    }
});

test('age and weight limits are enforced', () => {
    assert.strictEqual(eligibility.evaluateDonor({ ...healthyDonor, age: 16 }, null, NOW).eligible, false);
    assert.strictEqual(eligibility.evaluateDonor({ ...healthyDonor, age: 70 }, null, NOW).eligible, false);
    assert.strictEqual(eligibility.evaluateDonor({ ...healthyDonor, weight: '40' }, null, NOW).eligible, false);
    // Missing values must not block a donor — most legacy records have no weight recorded.
    assert.strictEqual(eligibility.evaluateDonor({ diseases: 'No' }, null, NOW).eligible, true);
});

test('multiple problems are all reported, not just the first', () => {
    const verdict = eligibility.evaluateDonor(
        { age: 15, weight: '30', diseases: 'Hepatitis', eligibility: 'ineligible' }, daysAgo(10), NOW);
    assert.strictEqual(verdict.eligible, false);
    assert.ok(verdict.reasons.length >= 4, `expected several reasons, got ${verdict.reasons.length}`);
});

test('nextEligibleDate is exactly 90 days after the last donation', () => {
    const last = daysAgo(10);
    const verdict = eligibility.evaluateDonor(healthyDonor, last, NOW);
    const expected = new Date(last.getTime() + 90 * 24 * 3600 * 1000);
    assert.strictEqual(verdict.nextEligibleDate.getTime(), expected.getTime());
});

test('daysUntilNextDonation never returns a negative number', () => {
    assert.strictEqual(eligibility.daysUntilNextDonation(daysAgo(500), NOW), 0);
    assert.strictEqual(eligibility.daysUntilNextDonation(null, NOW), 0);
});
