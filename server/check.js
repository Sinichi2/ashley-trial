// Self-check for the logic that's easy to get wrong: weekend dates across timezones, and weather-aware ranking.
// Run: node server/check.js
import assert from 'node:assert/strict';
import { weekendFor, pickActivities, googleDays, googleFacts, getPlan, placePhoto } from './data.js';

const wk = (tz, iso) => { const w = weekendFor(tz, new Date(iso)); return [w.today, w.saturday, w.sunday]; };

// Same instant, different local days. 2026-11-07 is a Saturday.
const instant = '2026-11-07T20:00:00Z';
assert.deepEqual(wk('America/Los_Angeles', instant), ['2026-11-07', '2026-11-07', '2026-11-08']); // Sat noon -> this weekend
assert.deepEqual(wk('Pacific/Auckland', instant), ['2026-11-08', '2026-11-14', '2026-11-15']);   // already Sun -> next weekend
assert.deepEqual(wk('Asia/Manila', instant), ['2026-11-08', '2026-11-14', '2026-11-15']);
// Midweek, and Sunday late evening just before local midnight
assert.deepEqual(wk('Europe/London', '2026-11-11T12:00:00Z'), ['2026-11-11', '2026-11-14', '2026-11-15']);
assert.deepEqual(wk('America/New_York', '2026-11-09T04:30:00Z'), ['2026-11-08', '2026-11-14', '2026-11-15']); // Sun 23:30 EST
// Month/year rollover: Thu 2026-12-31 -> Sat 2027-01-02
assert.deepEqual(wk('UTC', '2026-12-31T10:00:00Z'), ['2026-12-31', '2027-01-02', '2027-01-03']);
assert.throws(() => weekendFor('Not/AZone'));

// Ranking: rainy Saturday prefers indoor; sunny Sunday prefers outdoor; interest outweighs a small distance gap.
const v = (id, key, indoor, interests, distanceKm = 2) => ({ id, name: id, distanceKm, category: { key, indoor, interests, kid: 2 } });
const venues = [v('Aquarium', 'aquarium', true, ['animals']), v('Zoo', 'zoo', false, ['animals']), v('Gallery', 'art', true, ['arts'], 1)];
const rainy = { date: 'sat', available: true, outdoorOk: false, wet: true, condition: 'Rain', max: 15, unit: '°C', precipProb: 80 };
const sunny = { date: 'sun', available: true, outdoorOk: true, condition: 'Clear', max: 22, unit: '°C' };
const picks = pickActivities(venues, ['animals'], [rainy, sunny]);
assert.deepEqual(picks.map((p) => p.name), ['Aquarium', 'Zoo']);
assert.match(picks[0].why.interest, /Animals/);
assert.match(picks[0].why.weather, /indoor/);
// No weather: still returns picks, and says so
const noWx = pickActivities(venues, [], [{ date: 'sat', available: false }, { date: 'sun', available: false }]);
assert.equal(noWx.length, 2);
assert.match(noWx[0].why.weather, /not tailored/);
// Only one venue -> one pick, no crash
assert.equal(pickActivities([venues[0]], [], [sunny, sunny]).length, 1);

// Google Weather: {year,month,day} -> YYYY-MM-DD, matched by date (not position); missing dates are flagged unavailable.
const g = { forecastDays: [
  { displayDate: { year: 2026, month: 11, day: 15 }, maxTemperature: { degrees: 12, unit: 'CELSIUS' }, minTemperature: { degrees: 4 },
    daytimeForecast: { weatherCondition: { type: 'HEAVY_RAIN', description: { text: 'Heavy rain' } }, precipitation: { probability: { percent: 90 } } } },
  { displayDate: { year: 2026, month: 11, day: 14 }, maxTemperature: { degrees: 20, unit: 'CELSIUS' }, minTemperature: { degrees: 9 },
    daytimeForecast: { weatherCondition: { type: 'LIGHT_RAIN', description: { text: 'Light rain' } }, precipitation: { probability: { percent: 20 } } } },
] };
const [gSat, gSun, gMissing] = googleDays(g, ['2026-11-14', '2026-11-15', '2026-11-16']);
assert.equal(gSat.max, 20); assert.equal(gSat.outdoorOk, true); assert.equal(gSat.unit, '°C');
assert.equal(gSun.condition, 'Heavy rain'); assert.equal(gSun.wet, true);
assert.equal(gMissing.available, false);

console.log('check.js: all assertions passed');

// Planning facts: Google fields map to readable strings; absent fields stay empty (never guessed).
const gf = googleFacts({ priceLevel: 'PRICE_LEVEL_MODERATE', goodForChildren: true, restroom: true, parkingOptions: { paidParkingLot: true, freeStreetParking: false },
  accessibilityOptions: { wheelchairAccessibleEntrance: true }, regularOpeningHours: { weekdayDescriptions: ['Saturday: 10:00 AM – 6:00 PM'] }, rating: 4.6, userRatingCount: 120 });
assert.equal(gf.price, 'Moderate ($$)');
assert.deepEqual(gf.familyFeatures, ['Good for children', 'Restroom on site']);
assert.deepEqual(gf.parking, ['Paid parking lot']);
assert.equal(gf.weekdayHours[0], 'Saturday: 10:00 AM to 6:00 PM');
assert.equal(googleFacts({ priceRange: { startPrice: { currencyCode: 'GBP', units: '10' }, endPrice: { units: '20' } } }).price, 'GBP 10 to 20 per person');
assert.equal(googleFacts({}).price, null);
assert.deepEqual(googleFacts({}).accessibility, []);
console.log('check.js: planning-fact assertions passed');

// ---------- Stubbed-provider scenarios (controlled clock; fixtures live only in this file, never in the live app) ----------
process.env.GOOGLE_API_KEY = 'test-key';
const NOW = new Date('2026-11-11T12:00:00Z'); // Wednesday -> weekend 2026-11-14/15 in Europe/London
let F;
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const timeout = () => { throw Object.assign(new Error('stub timeout'), { name: 'TimeoutError' }); };
const gDay = (day, precip) => ({ displayDate: { year: 2026, month: 11, day }, maxTemperature: { degrees: 14, unit: 'CELSIUS' }, minTemperature: { degrees: 6 },
  daytimeForecast: { weatherCondition: { type: 'CLOUDY', description: { text: 'Cloudy' } }, precipitation: precip } });
const gPlace = (id, name, types, extra = {}) => ({ id, displayName: { text: name }, formattedAddress: `${id} Test St`, location: { latitude: F.lat + 0.01, longitude: -0.12 },
  primaryType: types[0], types, googleMapsUri: `https://maps.google.com/?cid=${id}`, ...extra });
globalThis.fetch = async (url, init) => {
  const host = new URL(url).host;
  if (host === 'weather.googleapis.com' || host === 'api.open-meteo.com') {
    if (F.wx === 'timeout') timeout();
    const days = [gDay(14, { probability: { percent: 0 }, qpf: { quantity: 0 } })]; // Saturday: zero, not missing
    if (F.wx === 'both') days.push(gDay(15, {})); // Sunday: precipitation missing entirely
    return ok({ forecastDays: days });
  }
  if (host === 'places.googleapis.com') {
    const t = JSON.parse(init.body).includedTypes[0];
    if (t === 'zoo') return ok({ places: [gPlace('z1', 'Test Zoo', ['zoo'], { goodForChildren: true }), gPlace('a1', 'Test Aquarium', ['aquarium']),
      gPlace('m1', 'Town Museum', ['museum'])] }); // generic museum, no family evidence -> must be filtered out
    if (t === 'italian_restaurant') return ok({ places: [gPlace('r1', 'Luigi Test', F.italianTypes)] });
    return ok({ places: [] });
  }
  throw new Error(`unexpected host in test: ${host}`);
};
const run = async (fx) => { F = fx; return getPlan({ lat: String(fx.lat), lon: '-0.12', tz: 'Europe/London', name: 'Testville', interests: 'science' }, NOW); };
const origErr = console.error; console.error = () => {}; // scenarios log expected failures

// Live-like happy path: dates, sources, retrievedAt, zero vs unknown precipitation, evidence filter.
let r = await run({ lat: 51.1, wx: 'both', italianTypes: ['italian_restaurant', 'restaurant'] });
assert.deepEqual([r.weekend.saturday, r.weekend.sunday], ['2026-11-14', '2026-11-15']);
assert.equal(r.weather.status, 'ok');
assert.equal(r.weather.days[0].precipProb, 0); assert.equal(r.weather.days[0].precipSum, 0);
assert.equal(r.weather.days[1].precipProb, null); assert.equal(r.weather.days[1].precipSum, null);
assert.equal(r.activities.status, 'ok');
assert.equal(r.activities.candidates, 3); assert.equal(r.activities.eligible, 2, 'generic museum without family evidence must be rejected before ranking');
for (const v of [...r.activities.items, r.restaurant.item]) { assert.match(v.sourceUrl, /^https:\/\//); assert.ok(v.retrievedAt); assert.ok(v.source); }
assert.equal(r.restaurant.status, 'ok'); assert.equal(r.restaurant.item.name, 'Luigi Test');
const firstFetch = r.weather.fetchedAt;
r = await run({ lat: 51.1, wx: 'both', italianTypes: ['italian_restaurant'] });
assert.equal(r.weather.fetchedAt, firstFetch, 'cached response keeps its original retrieval time');

// Weather provider times out (Google and Open-Meteo fallback): venues stay, no weather-based claims.
r = await run({ lat: 51.2, wx: 'timeout', italianTypes: ['italian_restaurant'] });
assert.equal(r.weather.status, 'unavailable'); assert.equal(r.weather.reasonCode, 'timeout');
assert.equal(r.activities.status, 'ok');
assert.ok(r.activities.items.every((v) => /not tailored/.test(v.why.weather)));

// Only one forecast day returned: valid day shown, missing day labeled unavailable.
r = await run({ lat: 51.3, wx: 'satOnly', italianTypes: ['italian_restaurant'] });
assert.equal(r.weather.status, 'partial'); assert.equal(r.weather.days[0].available, true); assert.equal(r.weather.days[1].available, false);

// Restaurant candidates without Italian evidence: report we couldn't verify one.
r = await run({ lat: 51.4, wx: 'both', italianTypes: ['restaurant', 'pizza_restaurant'] });
assert.equal(r.restaurant.status, 'unverified'); assert.equal(r.restaurant.item, null);
assert.equal(r.restaurant.message, 'We couldn’t verify a suitable Italian restaurant in this city.');

console.error = origErr;
console.log('check.js: stubbed-provider scenarios passed (happy path, cache timestamp, weather timeout, one forecast day, 0 vs unknown precip, no Italian evidence)');

// Filters: Indoors only is a hard filter; "Something different" sits outside the filters; dinner alternatives exist.
console.error = () => {};
F = { lat: 51.5, wx: 'both', italianTypes: ['italian_restaurant'] };
r = await getPlan({ lat: '51.5', lon: '-0.12', tz: 'Europe/London', name: 'Testville', interests: 'animals', indoor: '1' }, NOW);
console.error = origErr;
assert.ok(r.activities.items.every((v) => v.category.indoor === true), 'Indoors only must exclude outdoor/unknown venues');
assert.equal(r.activities.items[0].name, 'Test Aquarium');
assert.equal(r.activities.different?.name, 'Test Zoo', 'outdoor zoo is the outside-the-filter suggestion');
assert.match(r.activities.different.why.interest, /Outside your filters \(Animals, Indoors only\)/);
assert.ok(Array.isArray(r.restaurant.alternatives));
console.log('check.js: filter / something-different scenarios passed');

// Photo proxy only accepts Google photo resource names (not arbitrary URLs / path tricks).
for (const evil of ['https://evil.example/x.jpg', 'places/abc/photos/../../v1/x', 'places/abc/photos/x?key=1', '']) {
  await assert.rejects(placePhoto(evil), (e) => e.status === 400, `must reject ${evil}`);
}
assert.equal(googleFacts({ photos: [{ name: 'places/abc/photos/XYZ_1-2', authorAttributions: [{ displayName: 'Ana', uri: '//maps.google.com/maps/contrib/1' }] }] }).photo.authorUrl, 'https://maps.google.com/maps/contrib/1');
assert.equal(googleFacts({ photos: [{ name: 'https://evil.example/x' }] }).photo, null);
console.log('check.js: photo proxy validation passed');

// Location-based ranking: a visitor within 50 km is the distance origin; one farther away falls back to the city centre.
console.error = () => {};
F = { lat: 51.6, wx: 'both', italianTypes: ['italian_restaurant'] };
r = await getPlan({ lat: '51.6', lon: '-0.12', tz: 'Europe/London', name: 'Testville', from: '51.61,-0.12' }, NOW);
assert.equal(r.distanceFrom, 'you'); assert.ok(r.activities.items.every((v) => v.distanceFrom === 'you'));
r = await getPlan({ lat: '51.6', lon: '-0.12', tz: 'Europe/London', name: 'Testville', from: '40.7,-74.0' }, NOW);
assert.equal(r.distanceFrom, 'city centre');
console.error = origErr;
console.log('check.js: location-based ranking passed');
