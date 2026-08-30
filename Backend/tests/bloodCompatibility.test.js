const test = require('node:test');
const assert = require('node:assert');
const bc = require('../utils/bloodCompatibility');

test('normalize accepts the shapes blood groups actually arrive in', () => {
    assert.strictEqual(bc.normalize('a+'), 'A+');
    assert.strictEqual(bc.normalize(' AB- '), 'AB-');
    assert.strictEqual(bc.normalize('O positive'), 'O+');
    assert.strictEqual(bc.normalize('b negative'), 'B-');
    assert.strictEqual(bc.normalize('A Pos'), 'A+');
    assert.strictEqual(bc.normalize('Z+'), null);
    assert.strictEqual(bc.normalize(''), null);
    assert.strictEqual(bc.normalize(undefined), null);
});

test('O- is the universal donor', () => {
    for (const recipient of bc.BLOOD_GROUPS) {
        assert.ok(bc.isCompatible('O-', recipient), `O- should be able to donate to ${recipient}`);
    }
});

test('AB+ is the universal recipient', () => {
    for (const donor of bc.BLOOD_GROUPS) {
        assert.ok(bc.isCompatible(donor, 'AB+'), `${donor} should be able to donate to AB+`);
    }
});

test('rhesus negative recipients reject positive donors', () => {
    assert.ok(!bc.isCompatible('A+', 'A-'));
    assert.ok(!bc.isCompatible('O+', 'O-'));
    assert.ok(!bc.isCompatible('AB+', 'AB-'));
    // ...but the reverse direction is fine.
    assert.ok(bc.isCompatible('A-', 'A+'));
    assert.ok(bc.isCompatible('O-', 'O+'));
});

test('ABO groups do not cross', () => {
    assert.ok(!bc.isCompatible('A+', 'B+'));
    assert.ok(!bc.isCompatible('B-', 'A-'));
    assert.ok(!bc.isCompatible('AB+', 'A+'));
});

test('compatibleDonorGroups drives the matching query', () => {
    assert.deepStrictEqual(bc.compatibleDonorGroups('A+').sort(), ['A+', 'A-', 'O+', 'O-'].sort());
    assert.deepStrictEqual(bc.compatibleDonorGroups('O-'), ['O-']);
    assert.strictEqual(bc.compatibleDonorGroups('AB+').length, 8);
    assert.deepStrictEqual(bc.compatibleDonorGroups('nonsense'), []);
});

test('compatibleRecipientGroups is the inverse relation', () => {
    for (const donor of bc.BLOOD_GROUPS) {
        for (const recipient of bc.compatibleRecipientGroups(donor)) {
            assert.ok(bc.isCompatible(donor, recipient),
                `${donor} listed ${recipient} as servable but isCompatible disagrees`);
        }
    }
    assert.strictEqual(bc.compatibleRecipientGroups('O-').length, 8);
    assert.deepStrictEqual(bc.compatibleRecipientGroups('AB+'), ['AB+']);
});
