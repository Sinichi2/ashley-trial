// Data layer. All provider calls happen here, server-side; the key never leaves the server.
// Primary (when GOOGLE_API_KEY is set): Google Places API (New) + Google Weather API.
// Fallback (keyless): Open-Meteo (city search, forecast) + OpenStreetMap via Nominatim (venues, reverse geocode).
const HEADERS = { 'user-agent': 'FamilyWeekendPlanner/1.0 (practical assessment demo)' };
const KEY = () => process.env.GOOGLE_API_KEY || '';
const RADIUS_KM = 10;
export const INTERESTS = { animals: 'Animals', science: 'Science', nature: 'Nature', arts: 'Arts', history: 'History', handson: 'Action & Play' };

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const round1 = (n) => Math.round(n * 10) / 10;

const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Upstream failures carry only provider host + error category (never the URL, key, or raw provider text).
const upstream = (host, category, status) => Object.assign(new Error(`${host} ${category}${status ? ` (HTTP ${status})` : ''}`), { provider: host, category });
const httpCategory = (s) => s === 429 ? 'quota' : s === 401 || s === 403 || s === 400 ? 'auth_or_request' : s >= 500 ? 'upstream_error' : 'http_error';

async function getJson(url, init = {}) {
  const host = new URL(url).host;
  let r;
  try {
    r = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers }, signal: AbortSignal.timeout(init.timeoutMs || 15000) });
  } catch (e) { throw upstream(host, e.name === 'TimeoutError' || e.name === 'AbortError' ? 'timeout' : 'network'); }
  if (!r.ok) throw upstream(host, httpCategory(r.status), r.status);
  try { return await r.json(); } catch { throw upstream(host, 'invalid_response'); }
}
const logFail = (what, e) => console.error(`${what} failed: provider=${e.provider || 'internal'} category=${e.category || 'error'}${e.category ? '' : ` ${e.message}`}`);

// Nominatim usage policy: max 1 request/second. Serialize all calls through one queue.
// global 1 rps queue, so cold plans take ~8s; Google path.
let nominatimQueue = Promise.resolve();
function nominatim(path, params) {
  const run = nominatimQueue.then(() =>
    getJson(`https://nominatim.openstreetmap.org/${path}?${new URLSearchParams({ format: 'jsonv2', ...params })}`));
  nominatimQueue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// City search (Geo-encoding) 
export async function searchCities(raw) {
  const q = String(raw ?? '').trim();
  if (q.length < 2 || q.length > 80) throw bad('Search needs 2-80 characters.');
  // Open-Meteo matches on the name only, so "Paris, Texas" -> search "Paris", filter by "Texas".
  const [name, ...rest] = q.split(',').map((s) => s.trim());
  const qualifier = rest.join(' ').toLowerCase();
  const d = await cached(`geo:${name.toLowerCase()}`, 864e5, () =>
    getJson(`https://geocoding-api.open-meteo.com/v1/search?count=20&language=en&format=json&name=${encodeURIComponent(name)}`));
  return (d.results || [])
    .filter((c) => c.timezone)
    .map((c) => ({
      id: c.id, name: c.name, region: c.admin1 || null, area: c.admin2 || null,
      country: c.country || c.country_code, countryCode: c.country_code,
      lat: c.latitude, lon: c.longitude, timezone: c.timezone, population: c.population || null,
    }))
    .filter((c) => !qualifier || [c.region, c.area, c.country, c.countryCode].some((v) => v?.toLowerCase().startsWith(qualifier)))
    .slice(0, 10);
}

// "Use my location": reverse-geocode to a place name, then reuse city search and take the nearest match,
// so the result has exactly the same shape (and timezone) as a manually searched city.
export async function reverseCity(p) {
  const lat = Number(p.lat), lon = Number(p.lon);
  if (!p.lat || !p.lon || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) throw bad('Invalid coordinates.');
  const r = await nominatim('reverse', { lat, lon, zoom: 10, addressdetails: 1, 'accept-language': 'en' });
  const a = r.address || {};
  const name = a.city || a.town || a.village || a.municipality || a.county || r.name;
  if (!name) throw bad('Could not find a city at your location. Please search instead.', 404);
  const near = (await searchCities(name).catch(() => []))
    .map((c) => ({ ...c, distanceKm: round1(km({ lat, lon }, c)) }))
    .sort((x, y) => x.distanceKm - y.distanceKm)[0];
  if (!near || near.distanceKm > 50) throw bad(`Found "${name}" but could not match it to a city. Please search instead.`, 404);
  return near;
}

// ---------- Weekend dates (in the city's timezone) ----------
const ymd = (date, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export function weekendFor(timeZone, now = new Date()) {
  const today = ymd(now, timeZone); // throws RangeError on an unknown zone
  const t = new Date(`${today}T00:00:00Z`);
  const dow = t.getUTCDay(); // 0 = Sunday ... 6 = Saturday, in local calendar terms
  // Sat -> today (the weekend is still ahead). Sun -> next Sat: by Sunday the current weekend is mostly over,
  // so the brief plans the following one. Mon-Fri -> the upcoming Sat. All in the city's calendar, not the server's.
  const toSat = dow === 0 ? 6 : 6 - dow;
  const sat = new Date(t.getTime() + toSat * 864e5);
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    timezone: timeZone, today, saturday: iso(sat), sunday: iso(new Date(sat.getTime() + 864e5)),
    localTime: new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' }).format(now),
  };
}

// ---------- Forecast ----------
// One day shape for both providers. Temperatures in °C (both providers' metric default).
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null); // keeps 0, rejects missing/garbage
function makeDay({ date, condition, max, min, precipProb, precipSum, unit, rainy }) {
  max = num(max); min = num(min); precipProb = num(precipProb); precipSum = num(precipSum);
  // A day without valid temperatures or a known unit is treated as missing, not guessed.
  if (max === null || min === null || !['°C', '°F'].includes(unit)) return { date, available: false };
  const maxC = unit === '°F' ? ((max - 32) * 5) / 9 : max;
  const wet = (precipProb ?? 0) >= 50 || (precipSum ?? 0) >= 2 || rainy; // light drizzle alone doesn't cancel outdoor plans
  const cold = maxC < 8, hot = maxC > 32;
  return { date, available: true, condition: condition || 'Conditions not described', max, min, precipProb, precipSum, unit,
    wet, cold, hot, outdoorOk: !wet && !cold && !hot };
}

const wmo = (c) => c === 0 ? 'Clear' : c <= 2 ? 'Partly cloudy' : c === 3 ? 'Overcast' : c <= 48 ? 'Fog'
  : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow' : c <= 82 ? 'Rain showers' : c <= 86 ? 'Snow showers' : 'Thunderstorm';

export function openMeteoDays(d, dates) {
  const x = d.daily, unit = d.daily_units.temperature_2m_max;
  return dates.map((date) => {
    const i = x.time.indexOf(date); // match by date, never by index
    if (i < 0) return { date, available: false };
    const code = x.weather_code[i];
    return makeDay({ date, condition: wmo(code), max: x.temperature_2m_max[i], min: x.temperature_2m_min[i],
      precipProb: x.precipitation_probability_max[i], precipSum: x.precipitation_sum[i], unit, rainy: code >= 61 });
  });
}

export function googleDays(d, dates) {
  const byDate = new Map((d.forecastDays || []).map((f) => {
    const { year, month, day } = f.displayDate;
    return [`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, f];
  }));
  return dates.map((date) => {
    const f = byDate.get(date);
    if (!f) return { date, available: false };
    const day = f.daytimeForecast || {}, type = day.weatherCondition?.type || '';
    return makeDay({
      date, condition: day.weatherCondition?.description?.text || type.replace(/_/g, ' ').toLowerCase(),
      max: f.maxTemperature?.degrees, min: f.minTemperature?.degrees,
      precipProb: day.precipitation?.probability?.percent ?? null, precipSum: day.precipitation?.qpf?.quantity ?? null,
      unit: f.maxTemperature?.unit === 'FAHRENHEIT' ? '°F' : '°C',
      rainy: /RAIN|SNOW|THUNDER|HAIL/.test(type) && !/LIGHT|CHANCE|SCATTERED/.test(type),
    });
  });
}

async function forecast(lat, lon, tz, dates) {
  const at = () => new Date().toISOString();
  const where = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (KEY()) {
    try {
      const d = await cached(`gwx:${where}`, 18e5, async () => ({ ...(await getJson(
        `https://weather.googleapis.com/v1/forecast/days:lookup?location.latitude=${lat}&location.longitude=${lon}&days=10&pageSize=10`,
        { headers: { 'X-Goog-Api-Key': KEY() } })), fetchedAt: at() }));
      const days = googleDays(d, dates);
      if (days.some((x) => x.available)) return { source: 'Google Weather', sourceUrl: 'https://developers.google.com/maps/documentation/weather', fetchedAt: d.fetchedAt, days };
    } catch (e) { logFail('google weather (falling back to Open-Meteo)', e); }
  }
  // 9 days covers "today is Sunday -> following Sunday" (+7) with a day of slack.
  const d = await cached(`wx:${where},${tz}`, 18e5, async () => ({ ...(await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(tz)}`
    + '&forecast_days=9&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum')),
    fetchedAt: at() }));
  return { source: 'Open-Meteo', sourceUrl: 'https://open-meteo.com/', fetchedAt: d.fetchedAt, days: openMeteoDays(d, dates) };
}

// ---------- Venue categories ----------
// Which interests each serves, whether it's indoors, and a base suitability for ages 4-8.
// `test` reads OSM-style tags; Google results are mapped onto the same keys via GOOGLE_TYPES.
const CATEGORIES = [
  { key: 'zoo', label: 'Zoo', test: (t) => t.tourism === 'zoo', interests: ['animals', 'nature'], indoor: false, kid: 3,
    ages: 'Seeing animals up close holds the attention of 4-8 year olds, and you can make the visit as short as little legs need.' },
  { key: 'aquarium', label: 'Aquarium', test: (t) => t.tourism === 'aquarium', interests: ['animals', 'science'], indoor: true, kid: 3,
    ages: 'Big tanks and moving sea life are easy for 4-8 year olds to enjoy without reading labels.' },
  { key: 'childrens_museum', label: "Children's museum", test: (t) => t.tourism === 'museum' && /child/i.test(`${t.museum} ${t.name}`), interests: ['handson', 'science', 'arts'], indoor: true, kid: 3,
    ages: "Children's museums are built for touching and playing, the way 4-8 year olds learn best." },
  { key: 'planetarium', label: 'Planetarium', test: (t) => t.amenity === 'planetarium', interests: ['science'], indoor: true, kid: 2,
    ages: 'Stars on a dome feel like magic to 4-8 year olds; shows are seated and time-boxed.' },
  { key: 'science_museum', label: 'Science museum', test: (t) => t.tourism === 'museum' && /science|technolog|natural|nature|transport|railway|discovery/i.test(`${t.museum} ${t.name}`), interests: ['science'], indoor: true, kid: 2,
    ages: 'Dinosaurs, machines and big objects spark questions from 4-8 year olds.' },
  { key: 'history_museum', label: 'History museum', test: (t) => t.tourism === 'museum' && /histor|heritage|castle|palace|archaeolog|maritime/i.test(`${t.museum} ${t.name}`), interests: ['history'], indoor: true, kid: 1,
    ages: 'Old objects and stories from long ago give 4-8 year olds plenty to ask about; keep the visit short.' },
  { key: 'water_park', label: 'Water park', test: (t) => t.leisure === 'water_park', interests: ['handson'], indoor: false, kid: 2,
    ages: 'Splash areas are a favourite for 4-8 year olds; check depth zones for younger kids.' },
  { key: 'theme_park', label: 'Theme park', test: (t) => t.tourism === 'theme_park', interests: ['handson'], indoor: false, kid: 2,
    ages: 'Many rides suit 4-8 year olds, though height limits vary.' },
  { key: 'art_museum', label: 'Art museum / gallery', test: (t) => (t.tourism === 'museum' && /art/i.test(t.museum || '')) || t.tourism === 'gallery', interests: ['arts'], indoor: true, kid: 1,
    ages: 'Short visits with a "find the animal in the painting" game work well for 4-8 year olds.' },
  // An unspecified museum proves neither an indoor setting nor kid appeal: indoor unknown, and it is only
  // eligible when the provider itself marks it good for children (see eligibleActivity).
  { key: 'museum', label: 'Museum', test: (t) => t.tourism === 'museum', interests: [], indoor: null, kid: 0,
    ages: 'The listing marks this museum as good for children; check its official site for exhibits that suit ages 4-8.' },
  { key: 'playground', label: 'Playground', test: (t) => t.leisure === 'playground', interests: ['handson', 'nature'], indoor: false, kid: 2,
    ages: 'Playgrounds are made for this age: climbing, sliding, and making friends.' },
  { key: 'botanical_garden', label: 'Botanical garden', test: (t) => t.leisure === 'garden', interests: ['nature'], indoor: false, kid: 1,
    ages: 'Flowers, ponds and paths make an easy nature walk for 4-8 year olds.' },
  { key: 'nature_reserve', label: 'Nature reserve', test: (t) => t.leisure === 'nature_reserve', interests: ['nature', 'animals'], indoor: false, kid: 1,
    ages: 'Spotting birds and bugs is a real adventure for 4-8 year olds; pick a short trail.' },
  { key: 'historic_site', label: 'Historic site', test: (t) => !!t.historic, interests: ['history'], indoor: null, kid: 1,
    ages: 'Castles, ships and old buildings fire up the imagination of 4-8 year olds; check which parts are open to visitors.' },
  { key: 'park', label: 'Park', test: (t) => t.leisure === 'park', interests: ['nature'], indoor: false, kid: 1,
    ages: 'Open space to run around suits 4-8 year olds, and you can leave whenever you like.' },
];

// Google Places (New) Table A types -> the OSM-style tag our categories test for.
const GOOGLE_TYPES = {
  zoo: { tourism: 'zoo' }, aquarium: { tourism: 'aquarium' }, museum: { tourism: 'museum' },
  art_gallery: { tourism: 'gallery' }, amusement_park: { tourism: 'theme_park' }, water_park: { leisure: 'water_park' },
  planetarium: { amenity: 'planetarium' }, playground: { leisure: 'playground' }, botanical_garden: { leisure: 'garden' },
  park: { leisure: 'park' }, historical_landmark: { historic: 'landmark' }, national_park: { leisure: 'nature_reserve' }, hiking_area: { leisure: 'nature_reserve' },
};

const categorize = (tags) => CATEGORIES.find((c) => c.test(tags)) || null;

// Evidence gates: a venue needs identity, a valid location and a specific https listing before anything else looks at it.
const validVenue = (v) => typeof v.name === 'string' && v.name.trim() !== '' && num(v.lat) !== null && num(v.lon) !== null
  && Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180 && /^https:\/\/\S+$/.test(v.sourceUrl || '');
// Activity: category must show it suits ages 4-8 (kid > 0), or the provider marks it good for children.
const eligibleActivity = (v) => v.category.kid > 0 || v.facts.familyFeatures.includes('Good for children');

function baseVenue({ id, name, lat, lon, address, facts, sourceUrl, source }, origin, fetchedAt) {
  return {
    id, name, lat, lon, source, address: address || null, distanceKm: round1(km(origin, { lat, lon })),
    // Source facts only: copied from the provider, null when not provided. Never filled in by us.
    facts: { website: null, openingHours: null, wheelchair: null, fee: null, cuisine: null, kidFriendlyTags: [],
      price: null, photo: null, weekdayHours: null, hoursForDay: null, accessibility: [], familyFeatures: [], parking: [], rating: null, ratingCount: null, ...facts },
    sourceUrl, directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, retrievedAt: fetchedAt,
  };
}

// ---------- Planning facts (copied from the provider; empty when not provided, never guessed) ----------
const PRICE_LEVEL = { PRICE_LEVEL_FREE: 'Free', PRICE_LEVEL_INEXPENSIVE: 'Inexpensive ($)', PRICE_LEVEL_MODERATE: 'Moderate ($$)',
  PRICE_LEVEL_EXPENSIVE: 'Expensive ($$$)', PRICE_LEVEL_VERY_EXPENSIVE: 'Very expensive ($$$$)' };
const plainDash = (s) => s.replace(/\s*[–—]\s*/g, ' to ').replace(/[  ]/g, ' ');
const money = (p) => p && `${p.currencyCode} ${p.units ?? 0}`;
const PARKING = { freeParkingLot: 'Free parking lot', paidParkingLot: 'Paid parking lot', freeStreetParking: 'Free street parking',
  paidStreetParking: 'Paid street parking', freeGarageParking: 'Free garage', paidGarageParking: 'Paid garage', valetParking: 'Valet parking' };
const ACCESS = { wheelchairAccessibleEntrance: 'Step-free entrance', wheelchairAccessibleRestroom: 'Accessible restroom',
  wheelchairAccessibleParking: 'Accessible parking', wheelchairAccessibleSeating: 'Accessible seating' };

export function googleFacts(p) {
  const r = p.priceRange;
  return {
    website: p.websiteUri || null,
    price: r?.startPrice ? `${money(r.startPrice)}${r.endPrice ? ` to ${r.endPrice.units}` : '+'} per person` : PRICE_LEVEL[p.priceLevel] || null,
    weekdayHours: p.regularOpeningHours?.weekdayDescriptions?.map(plainDash) || null,
    accessibility: Object.keys(ACCESS).filter((k) => p.accessibilityOptions?.[k] === true).map((k) => ACCESS[k]),
    familyFeatures: [p.goodForChildren && 'Good for children', p.menuForChildren && 'Kids menu', p.restroom && 'Restroom on site'].filter(Boolean),
    parking: Object.keys(PARKING).filter((k) => p.parkingOptions?.[k] === true).map((k) => PARKING[k]),
    rating: p.rating ?? null, ratingCount: p.userRatingCount ?? null,
    photo: googlePhoto(p.photos?.[0]),
  };
}

// First listing photo, served through our own /api/photo so the key never reaches the browser.
// Google requires showing the photo author, so the attribution travels with it.
const PHOTO_NAME = /^places\/[A-Za-z0-9_-]{1,300}\/photos\/[A-Za-z0-9_-]{1,2000}$/;
function googlePhoto(ph) {
  if (!ph || !PHOTO_NAME.test(ph.name || '')) return null;
  const a = ph.authorAttributions?.[0] || {}, uri = a.uri?.startsWith('//') ? `https:${a.uri}` : a.uri;
  return { url: `/api/photo?name=${encodeURIComponent(ph.name)}`, author: a.displayName || null, authorUrl: /^https:\/\//.test(uri || '') ? uri : null };
}

const photoCache = new Map();
// Only Google photo resource names are accepted, so this can't be abused as an open proxy for arbitrary URLs.
export async function placePhoto(name) {
  if (!PHOTO_NAME.test(String(name || ''))) throw bad('Invalid photo reference.');
  if (!KEY()) throw bad('Photos are unavailable.', 404);
  const hit = photoCache.get(name);
  if (hit && Date.now() - hit.at < 864e5) return hit;
  // skipHttpRedirect returns the image URL as JSON, so the key is never forwarded to the image host.
  const { photoUri } = await getJson(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&skipHttpRedirect=true`, { headers: { 'X-Goog-Api-Key': KEY() } });
  if (!/^https:\/\//.test(photoUri || '')) throw upstream('places.googleapis.com', 'invalid_response');
  let r;
  try { r = await fetch(photoUri, { signal: AbortSignal.timeout(15000) }); } catch { throw upstream('photo host', 'timeout'); }
  const type = (r.headers.get('content-type') || '').split(';')[0];
  const body = Buffer.from(await r.arrayBuffer());
  if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type) || body.length > 3e6) throw upstream('photo host', 'invalid_response', r.status);
  if (photoCache.size > 300) photoCache.clear();
  const v = { at: Date.now(), type, body };
  photoCache.set(name, v);
  return v;
}

// Opening hours for the day the family will actually go ("Saturday: 10:00 AM to 6:00 PM").
const hoursFor = (facts, ymd) => {
  const day = ymd && new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return facts.weekdayHours?.find((h) => h.startsWith(day)) || null;
};

// ---------- Venues: Google Places (New) ----------
async function googleVenues(lat, lon) {
  const search = (includedTypes) => getJson('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'X-Goog-Api-Key': KEY(),
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.googleMapsUri,'
        + 'places.websiteUri,places.priceLevel,places.priceRange,places.regularOpeningHours.weekdayDescriptions,places.accessibilityOptions,'
        + 'places.goodForChildren,places.menuForChildren,places.restroom,places.parkingOptions,places.rating,places.userRatingCount,places.photos',
    },
    body: JSON.stringify({ includedTypes, maxResultCount: 20, languageCode: 'en',
      locationRestriction: { circle: { center: { latitude: lat, longitude: lon }, radius: RADIUS_KM * 1000 } } }),
  });
  // Two activity calls so popular parks don't crowd out museums in a single top-20 list.
  const [indoor, outdoor, food] = await Promise.all([
    search(['zoo', 'aquarium', 'museum', 'art_gallery', 'planetarium']),
    search(['amusement_park', 'water_park', 'playground', 'botanical_garden', 'park', 'national_park', 'hiking_area', 'historical_landmark']),
    search(['italian_restaurant']),
  ]);
  const fetchedAt = new Date().toISOString(), origin = { lat, lon };
  const toV = (p, extra) => baseVenue({
    id: `google/${p.id}`, name: p.displayName?.text, lat: p.location.latitude, lon: p.location.longitude,
    address: p.formattedAddress, sourceUrl: p.googleMapsUri, source: 'Google Places', facts: { ...googleFacts(p), ...extra },
  }, origin, fetchedAt);
  const places = [...(indoor.places || []), ...(outdoor.places || [])].flatMap((p) => {
    if (!p.location) return [];
    const type = [p.primaryType, ...(p.types || [])].find((t) => GOOGLE_TYPES[t]);
    const category = type && categorize({ ...GOOGLE_TYPES[type], name: p.displayName?.text });
    const v = category && toV(p);
    return v && validVenue(v) ? [{ ...v, category }] : [];
  });
  // Italian evidence = Google's own italian_restaurant type on the place, not just that it came back from the search.
  const italian = (food.places || [])
    .filter((p) => p.location && [p.primaryType, ...(p.types || [])].includes('italian_restaurant'))
    .map((p) => toV(p, { cuisine: 'italian' })).filter(validVenue);
  return { source: 'Google Places', fetchedAt, places, italian };
}

// ---------- Venues: OpenStreetMap via Nominatim (keyless fallback) ----------
// Overpass was the first choice but took 28–90s per query from the server (public instance overloaded).
const OSM_QUERIES = ['zoo', 'aquarium', 'museum', 'art gallery', 'playground', 'park', 'theme park', 'water park', 'nature reserve'];

async function osmVenues(lat, lon) {
  const dLat = RADIUS_KM / 111, dLon = RADIUS_KM / (111 * Math.cos((lat * Math.PI) / 180));
  const box = { viewbox: [lon - dLon, lat + dLat, lon + dLon, lat - dLat].join(','), bounded: 1, limit: 30, extratags: 1, addressdetails: 1, 'accept-language': 'en' };
  const settled = await Promise.allSettled([...OSM_QUERIES, 'italian restaurant'].map((q) => nominatim('search', { q, ...box })));
  if (settled.every((s) => s.status === 'rejected')) throw settled[0].reason;
  const fetchedAt = new Date().toISOString(), origin = { lat, lon }, seen = new Set(), places = [], italian = [];
  for (const r of settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))) {
    const id = `${r.osm_type}/${r.osm_id}`;
    if (!r.name || seen.has(id)) continue;
    seen.add(id);
    const x = r.extratags || {}, a = r.address || {};
    const tags = { ...x, name: r.name, [r.category]: r.type };
    const v = baseVenue({
      id: `osm/${id}`, name: r.name, lat: Number(r.lat), lon: Number(r.lon), sourceUrl: `https://www.openstreetmap.org/${id}`, source: 'OpenStreetMap (Nominatim)',
      address: [[a.house_number, a.road].filter(Boolean).join(' '), a.city || a.town || a.village].filter(Boolean).join(', '),
      facts: { website: x.website || x['contact:website'] || null, openingHours: x.opening_hours || null, wheelchair: x.wheelchair || null,
        fee: x.fee || null, cuisine: x.cuisine || null, kidFriendlyTags: ['highchair', 'kids_area', 'changing_table'].filter((k) => x[k] === 'yes'),
        price: x.fee === 'no' ? 'Free' : x.charge ? `Paid entry (${x.charge})` : x.fee === 'yes' ? 'Paid entry' : null,
        accessibility: { yes: ['Wheelchair accessible'], limited: ['Limited wheelchair access'] }[x.wheelchair] || [],
        familyFeatures: [x.highchair === 'yes' && 'High chairs', x.kids_area === 'yes' && 'Kids area', x.changing_table === 'yes' && 'Baby changing table'].filter(Boolean) },
    }, origin, fetchedAt);
    if (!validVenue(v)) continue;
    if (tags.amenity === 'restaurant') {
      // Italian evidence: OSM cuisine tag, or an explicitly Italian word in the name (whole word, so "Hospital"/"Capital" don't match).
      if (/italian/i.test(x.cuisine || '') || /\b(italian|italiano|italiana|trattoria|osteria)\b/i.test(r.name)) italian.push(v);
      continue;
    }
    const category = categorize(tags);
    if (category) places.push({ ...v, category });
  }
  return { source: 'OpenStreetMap (Nominatim)', fetchedAt, places, italian };
}

// ---------- Ranking (recommendation reasoning, kept separate from facts) ----------
const interestHit = (v, interests) => interests.find((i) => v.category.interests.includes(i)) || null;

function score(v, interests, day) {
  let s = v.category.kid - v.distanceKm / 5;
  if (interests.length) s += interestHit(v, interests) ? 4 : -2;
  // Weather only scores when we have a forecast and the setting is known (indoor null = unknown -> no weather score).
  if (day.available && v.category.indoor !== null) s += day.outdoorOk ? (v.category.indoor ? 0 : 2) : (v.category.indoor ? 3 : -3);
  return s;
}

function weatherWhy(v, day) {
  if (!day.available) return 'Forecast unavailable, so this pick was not tailored to the weather.';
  const deg = `${Math.round(day.max)}${day.unit}`;
  const issue = day.wet ? `${day.condition}${day.precipProb !== null ? ` (${day.precipProb}% chance of precipitation)` : ''}` : day.cold ? `A cold day (high ${deg})` : day.hot ? `A hot day (high ${deg})` : null;
  if (v.category.indoor === null) return issue
    ? `${issue} is forecast, and the listing doesn't say whether it is indoors, so check before you go.`
    : `${day.condition}, high ${deg}: no weather concerns for this day.`;
  if (!issue) return v.category.indoor
    ? `${day.condition}, high ${deg}: fine either way; this one is indoors.`
    : `${day.condition}, high ${deg}: good conditions for an outdoor visit.`;
  return v.category.indoor ? `${issue} is forecast, so an indoor pick keeps the day comfortable.`
    : `${issue} is forecast and this is outdoors; dress for it or swap with the other day.`;
}

function explain(v, interests, day, interestLine) {
  const hit = interestHit(v, interests);
  return { ...v, matchedInterest: hit, why: {
    ages: v.category.ages,
    interest: interestLine || (hit ? `Matches your interest: ${INTERESTS[hit]}.`
      : interests.length ? 'No nearby venue matched your interests as well; this is the strongest family option nearby.'
      : 'No interests selected, so this was ranked on general appeal for ages 4-8 and distance.'),
    weather: weatherWhy(v, day),
  } };
}

// After the two day picks: up to 2 more that fit the filters, and 1 deliberately outside them ("Something different").
export function extraActivities(eligible, picks, interests, indoorOnly, day) {
  const used = new Set(picks.map((p) => p.id));
  const fits = (v) => (!interests.length || !!interestHit(v, interests)) && (!indoorOnly || v.category.indoor === true);
  const ranked = (list, ints) => list.map((v) => ({ v, s: score(v, ints, day) })).sort((a, b) => b.s - a.s).map((x) => x.v);
  const more = ranked(eligible.filter((v) => !used.has(v.id) && fits(v)), interests).slice(0, 2);
  const taken = new Set([...used, ...more.map((v) => v.id)]), cats = new Set([...picks, ...more].map((v) => v.category.key));
  const filtered = interests.length > 0 || indoorOnly;
  const pool = eligible.filter((v) => !taken.has(v.id) && (filtered ? !fits(v) : !cats.has(v.category.key)));
  const d = ranked(pool, [])[0];
  const labels = [...interests.map((i) => INTERESTS[i]), ...(indoorOnly ? ['Indoors only'] : [])].join(', ');
  const dayName = new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const tag = (x) => ({ ...x, day: null, why: { ...x.why, weather: `${dayName}: ${x.why.weather}` } });
  return {
    more: more.map((v) => tag(explain(v, interests, day))),
    different: d ? tag(explain(d, [], day, filtered
      ? `Outside your filters (${labels}): a ${d.category.label.toLowerCase()} nearby, in case the family wants something different.`
      : `Something different from your other picks: a ${d.category.label.toLowerCase()} nearby.`)) : null,
  };
}

export function pickActivities(venues, interests, days) {
  const picks = [];
  for (const day of days) {
    let best = null;
    for (const v of venues) {
      if (picks.some((p) => p.id === v.id)) continue;
      const s = score(v, interests, day) - (picks.some((p) => p.category.key === v.category.key) ? 2 : 0);
      if (!best || s > best.s) best = { v, s };
    }
    if (!best) break;
    picks.push({ ...explain(best.v, interests, day), day: day.date });
  }
  return picks;
}

function pickRestaurant(restaurants, anchor, origin, cityName) {
  if (!restaurants.length) return [];
  const from = anchor || origin;
  // Ranked list: [0] is the main pick, the next two are alternatives.
  return restaurants
    .map((r) => ({ r, d: km(from, r), s: km(from, r) - (r.facts.familyFeatures.length ? 2 : 0) }))
    .sort((a, b) => a.s - b.s).slice(0, 3).map((best) => {
      const near = anchor ? `About ${round1(best.d)} km from ${anchor.name}, so it slots in before or after that outing.`
        : `About ${round1(best.d)} km from the centre of ${cityName}.`;
      const kids = best.r.facts.familyFeatures.length ? ` The listing mentions: ${best.r.facts.familyFeatures.join(', ').toLowerCase()}.` : '';
      return { ...best.r, why: near + kids };
    });
}

// ---------- Route estimate (OSRM public router, OpenStreetMap data; driving only) ----------
const point = (s) => { const [la, lo] = String(s || '').split(',').map(Number); return Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? { lat: la, lon: lo } : null; };
export async function routeBetween(p) {
  const a = point(p.from), b = point(p.to);
  if (!a || !b) throw bad('Use from=LAT,LON&to=LAT,LON.');
  if (km(a, b) > 200) throw bad('Route estimates are limited to 200 km.');
  const key = [a.lat, a.lon, b.lat, b.lon].map((n) => n.toFixed(4)).join(',');
  const d = await cached(`route:${key}`, 36e5, () => getJson(
    `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=simplified&geometries=geojson`));
  const r = d.routes?.[0];
  if (!r) throw bad('No route found between these points.', 404);
  return { distanceKm: round1(r.distance / 1000), durationMin: Math.max(1, Math.round(r.duration / 60)), mode: 'driving',
    geometry: r.geometry.coordinates.map(([lo, la]) => [la, lo]), source: 'OSRM routing on OpenStreetMap data' };
}

// ---------- Plan ----------
// Section result: { status: ok | partial | unverified | unavailable, reasonCode, sources, message, ...data }.
//   unavailable = upstream failed (timeout/quota/...); unverified = provider answered but nothing had enough evidence;
//   partial = some requested results usable. Each section is computed independently; one failing never hides another.
export async function getPlan(p, now = new Date()) {
  const lat = Number(p.lat), lon = Number(p.lon), tz = String(p.tz || '');
  if (!p.lat || !p.lon || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) throw bad('Invalid coordinates.');
  const interests = String(p.interests || '').split(',').filter(Boolean);
  if (interests.some((i) => !INTERESTS[i])) throw bad('Unknown interest.');
  const indoorOnly = p.indoor === '1';
  const city = String(p.name || 'this city').slice(0, 100);
  let weekend;
  try { weekend = weekendFor(tz, now); } catch { throw bad('Unknown timezone.'); }

  // Personal origin: the visitor's shared location, used only when it is within 50 km of the chosen city.
  const me = point(p.from);
  const origin = me && km(me, { lat, lon }) <= 50 ? me : { lat, lon };
  const distanceFrom = origin === me ? 'you' : 'city centre';
  const dates = [weekend.saturday, weekend.sunday];
  const where = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const venueData = async () => {
    if (KEY()) {
      try { return await cached(`gplaces:${where}`, 36e5, () => googleVenues(lat, lon)); }
      catch (e) { logFail('google places (falling back to OpenStreetMap)', e); }
    }
    return cached(`osm:${where}`, 36e5, () => osmVenues(lat, lon));
  };
  // Concurrent, each bounded by getJson's timeout.
  const [wx, ven] = await Promise.allSettled([forecast(lat, lon, tz, dates), venueData()]);
  if (wx.status === 'rejected') logFail('weather', wx.reason);
  if (ven.status === 'rejected') logFail('venues', ven.reason);

  let weather;
  if (wx.status === 'fulfilled') {
    const { source, sourceUrl, ...rest } = wx.value, got = rest.days.filter((d) => d.available).length;
    weather = { ...rest, source, sources: [{ name: source, url: sourceUrl }],
      status: got === 2 ? 'ok' : got === 1 ? 'partial' : 'unverified',
      reasonCode: got === 2 ? null : got === 1 ? 'missing_forecast_day' : 'no_forecast_for_weekend',
      message: got === 2 ? null : got === 1 ? 'The forecast only covers one weekend day; the other is shown as unavailable.'
        : 'The forecast did not include this weekend, so recommendations are not weather-tailored.' };
  } else {
    weather = { status: 'unavailable', reasonCode: wx.reason?.category || 'error', sources: [],
      message: 'The forecast service is unavailable right now. Recommendations below are not weather-tailored.',
      days: dates.map((date) => ({ date, available: false })) };
  }

  let activities, restaurant;
  const attribution = [];
  if (ven.status === 'fulfilled') {
    // Venues are cached per city; distance (and so ranking) is recomputed from this visitor's origin.
    const near = (v) => ({ ...v, distanceKm: round1(km(origin, v)), distanceFrom });
    const places = ven.value.places.map(near), italian = ven.value.italian.map(near), { source } = ven.value;
    const sources = [{ name: source, url: source === 'Google Places' ? 'https://www.google.com/maps' : 'https://www.openstreetmap.org/' }];
    const eligible = places.filter(eligibleActivity); // filter on evidence first, then rank
    const pool = indoorOnly ? eligible.filter((v) => v.category.indoor === true) : eligible; // hard filter: proven indoor only
    const slim = ({ category: { key, label, indoor }, ...v }) => ({ ...v, facts: { ...v.facts, hoursForDay: hoursFor(v.facts, v.day || weekend.saturday) }, category: { key, label, indoor } });
    const items = pickActivities(pool, interests, weather.days)
      .map(slim);
    const extra = extraActivities(eligible, items, interests, indoorOnly, weather.days[0]);
    const noInterestMatch = interests.length > 0 && items.length > 0 && !items.some((v) => v.matchedInterest);
    activities = {
      status: items.length === 2 ? 'ok' : items.length === 1 ? 'partial' : 'unverified',
      reasonCode: items.length === 2 ? (noInterestMatch ? 'no_interest_match' : null) : items.length === 1 ? 'single_eligible_activity' : 'no_eligible_activity',
      source, sources, items, more: extra.more.map(slim), different: extra.different && slim(extra.different), candidates: places.length, eligible: eligible.length,
      message: items.length === 0 ? (indoorOnly && eligible.length ? `No venue within ${RADIUS_KM} km is confirmed as indoors by its listing. Try turning off Indoors only.` : `We couldn't verify a family activity for ages 4-8 within ${RADIUS_KM} km of ${city}.`) : null,
      note: items.length === 1 ? `Only one venue within ${RADIUS_KM} km had enough evidence to suit ages 4-8, so there is a single pick.`
        : noInterestMatch ? 'No nearby eligible venue matched your selected interests, so these are the best family options instead.' : null,
    };
    const dinnerDay = items[0]?.day || weekend.saturday;
    const [item, ...alternatives] = pickRestaurant(italian, items[0], origin, city)
      .map((r) => ({ ...r, facts: { ...r.facts, hoursForDay: hoursFor(r.facts, dinnerDay) } }));
    restaurant = {
      status: item ? 'ok' : 'unverified', reasonCode: item ? null : 'no_verified_italian', source, sources, item: item || null, alternatives, candidates: italian.length,
      message: item ? null : "We couldn’t verify a suitable Italian restaurant in this city.",
    };
    attribution.push(source === 'Google Places'
      ? { text: 'Places data © Google Maps', url: 'https://www.google.com/maps' }
      : { text: '© OpenStreetMap contributors (ODbL), via Nominatim', url: 'https://www.openstreetmap.org/copyright' });
  } else {
    const reasonCode = ven.reason?.category || 'error';
    const message = 'The venue data service is unavailable right now. Please try again in a minute.';
    activities = { status: 'unavailable', reasonCode, sources: [], message, items: [] };
    restaurant = { status: 'unavailable', reasonCode, sources: [], message, item: null };
  }
  if (weather.source === 'Google Weather') attribution.push({ text: 'Weather data © Google', url: 'https://developers.google.com/maps/documentation/weather' });
  if (weather.source === 'Open-Meteo') attribution.push({ text: 'Weather data by Open-Meteo.com (CC BY 4.0)', url: 'https://open-meteo.com/' });

  return { city, lat, lon, interests, distanceFrom, weekend, weather, activities, restaurant, attribution };
}
