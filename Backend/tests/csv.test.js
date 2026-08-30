const test = require('node:test');
const assert = require('node:assert');
const { toCsv, escapeCell } = require('../utils/csv');

test('values containing delimiters, quotes or newlines are quoted', () => {
    assert.strictEqual(escapeCell('plain'), 'plain');
    assert.strictEqual(escapeCell('has,comma'), '"has,comma"');
    assert.strictEqual(escapeCell('has "quotes"'), '"has ""quotes"""');
    assert.strictEqual(escapeCell('line\nbreak'), '"line\nbreak"');
});

test('null and undefined become empty cells rather than the words', () => {
    assert.strictEqual(escapeCell(null), '');
    assert.strictEqual(escapeCell(undefined), '');
    assert.strictEqual(escapeCell(0), '0');
    assert.strictEqual(escapeCell(false), 'false');
});

test('dates are serialised in a sortable format', () => {
    assert.strictEqual(escapeCell(new Date('2026-08-29T10:00:00Z')), '2026-08-29T10:00:00.000Z');
});

test('a report renders its labelled columns in order', () => {
    const csv = toCsv(
        [{ name: 'Vivek', group: 'O+' }, { name: 'Rasmi', group: 'A-' }],
        [{ key: 'name', label: 'Donor' }, { key: 'group', label: 'Blood Group' }]
    );
    assert.deepStrictEqual(csv.split('\r\n'), ['Donor,Blood Group', 'Vivek,O+', 'Rasmi,A-']);
});

test('a computed column can derive its value from the row', () => {
    const csv = toCsv([{ first: 'A', last: 'B' }],
        [{ key: 'full', label: 'Name', value: (r) => `${r.first} ${r.last}` }]);
    assert.strictEqual(csv, 'Name\r\nA B');
});

test('an empty report still emits usable output', () => {
    assert.strictEqual(toCsv([], [{ key: 'a', label: 'A' }]), 'A');
    assert.strictEqual(toCsv([], []), '');
});
