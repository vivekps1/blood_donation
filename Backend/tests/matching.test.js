const test = require('node:test');
const assert = require('node:assert');
const matching = require('../utils/matching');

test('haversine measures real distances', () => {
    // Kochi to Ernakulam North, roughly 11km.
    const km = matching.haversineKm([76.2673, 9.9312], [76.2999, 10.0261]);
    assert.ok(km > 10 && km < 13, `expected ~11km, got ${km}`);

    // Identical points are zero apart.
    assert.strictEqual(Math.round(matching.haversineKm([76.2673, 9.9312], [76.2673, 9.9312])), 0);

    // Missing or malformed input yields null rather than NaN.
    assert.strictEqual(matching.haversineKm(null, [1, 2]), null);
    assert.strictEqual(matching.haversineKm([1, 2], ['a', 'b']), null);
});

test('coordsOf accepts valid GeoJSON and rejects the [0,0] placeholder', () => {
    assert.deepStrictEqual(matching.coordsOf({ type: 'Point', coordinates: [76.2, 9.9] }), [76.2, 9.9]);
    // The Hospital schema defaults locationGeo.coordinates to [0,0]; treating that as a
    // real location would place every hospital in the Atlantic.
    assert.strictEqual(matching.coordsOf({ coordinates: [0, 0] }), null);
    assert.strictEqual(matching.coordsOf({ coordinates: [1] }), null);
    assert.strictEqual(matching.coordsOf({}), null);
    assert.strictEqual(matching.coordsOf(null), null);
});

test('scoring prefers near donors over distant ones', () => {
    const near = matching.scoreCandidate({ distanceKm: 2, donationCount: 0, exactGroupMatch: false }, 30);
    const far = matching.scoreCandidate({ distanceKm: 28, donationCount: 0, exactGroupMatch: false }, 30);
    assert.ok(near > far, `near (${near}) should outrank far (${far})`);
});

test('scoring rewards a donation record and an exact blood group match', () => {
    const base = { distanceKm: 10, donationCount: 0, exactGroupMatch: false };
    const experienced = matching.scoreCandidate({ ...base, donationCount: 5 }, 30);
    const exact = matching.scoreCandidate({ ...base, exactGroupMatch: true }, 30);
    const plain = matching.scoreCandidate(base, 30);

    assert.ok(experienced > plain, 'previous donations should raise the score');
    assert.ok(exact > plain, 'an exact group match should raise the score');
});

test('an unknown distance scores mid-range rather than zero', () => {
    // A donor who has not saved a location must remain reachable, just ranked lower than
    // one we can actually locate nearby.
    const unknown = matching.scoreCandidate({ distanceKm: null, donationCount: 0, exactGroupMatch: false }, 30);
    const veryFar = matching.scoreCandidate({ distanceKm: 29.9, donationCount: 0, exactGroupMatch: false }, 30);
    const veryNear = matching.scoreCandidate({ distanceKm: 0.5, donationCount: 0, exactGroupMatch: false }, 30);

    assert.ok(unknown > veryFar, 'unknown distance should outrank a donor at the edge of the radius');
    assert.ok(unknown < veryNear, 'unknown distance should not outrank a donor next door');
});

test('the perfect candidate scores at the top of the range', () => {
    const best = matching.scoreCandidate({ distanceKm: 0, donationCount: 100, exactGroupMatch: true }, 30);
    assert.strictEqual(best, 100);
});
