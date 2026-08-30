const test = require('node:test');
const assert = require('node:assert');
const inventory = require('../utils/inventory');
const { compatibleDonorGroups } = require('../utils/bloodCompatibility');

test('whole blood expires 42 days after collection', () => {
    assert.strictEqual(inventory.SHELF_LIFE_DAYS, 42);
    const collected = new Date('2026-08-29T00:00:00.000Z');
    const expiry = inventory.shelfLifeExpiry(collected);
    const days = (expiry - collected) / (24 * 3600 * 1000);
    assert.strictEqual(days, 42);
});

test('usable stock for a patient spans every compatible group, not just their own', () => {
    // The availability endpoint sums stock across these groups; this is the rule it uses.
    const stock = { 'A+': 2, 'A-': 1, 'O+': 4, 'O-': 3, 'B+': 9, 'AB+': 7 };
    const usableFor = (patientGroup) => compatibleDonorGroups(patientGroup)
        .reduce((total, group) => total + (stock[group] || 0), 0);

    // An A+ patient can receive A+, A-, O+ and O- = 2 + 1 + 4 + 3.
    assert.strictEqual(usableFor('A+'), 10);
    // An O- patient can only receive O-.
    assert.strictEqual(usableFor('O-'), 3);
    // An AB+ patient can receive everything on the shelf.
    assert.strictEqual(usableFor('AB+'), 26);
});
