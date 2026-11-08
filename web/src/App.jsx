import { useEffect, useMemo, useRef, useState } from 'react';
import FamilyRestroomRounded from '@mui/icons-material/FamilyRestroomRounded';
import PetsRounded from '@mui/icons-material/PetsRounded';
import ScienceRounded from '@mui/icons-material/ScienceRounded';
import ParkRounded from '@mui/icons-material/ParkRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import HistoryEduRounded from '@mui/icons-material/HistoryEduRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import WbSunnyRounded from '@mui/icons-material/WbSunnyRounded';
import WbCloudyRounded from '@mui/icons-material/WbCloudyRounded';
import CloudRounded from '@mui/icons-material/CloudRounded';
import UmbrellaRounded from '@mui/icons-material/UmbrellaRounded';
import ThunderstormRounded from '@mui/icons-material/ThunderstormRounded';
import AcUnitRounded from '@mui/icons-material/AcUnitRounded';
import ThermostatRounded from '@mui/icons-material/ThermostatRounded';
import WaterDropRounded from '@mui/icons-material/WaterDropRounded';
import WaterRounded from '@mui/icons-material/WaterRounded';
import ToysRounded from '@mui/icons-material/ToysRounded';
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded';
import PoolRounded from '@mui/icons-material/PoolRounded';
import AttractionsRounded from '@mui/icons-material/AttractionsRounded';
import MuseumRounded from '@mui/icons-material/MuseumRounded';
import LocalFloristRounded from '@mui/icons-material/LocalFloristRounded';
import ForestRounded from '@mui/icons-material/ForestRounded';
import SportsHandballRounded from '@mui/icons-material/SportsHandballRounded';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import MyLocationRounded from '@mui/icons-material/MyLocationRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import LanguageRounded from '@mui/icons-material/LanguageRounded';
import RestaurantRounded from '@mui/icons-material/RestaurantRounded';
import EventRounded from '@mui/icons-material/EventRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import ChildCareRounded from '@mui/icons-material/ChildCareRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import MenuRounded from '@mui/icons-material/MenuRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import AccessibleRounded from '@mui/icons-material/AccessibleRounded';
import LocalParkingRounded from '@mui/icons-material/LocalParkingRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import TravelExploreRounded from '@mui/icons-material/TravelExploreRounded';
import MapRounded from '@mui/icons-material/MapRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import InfoRounded from '@mui/icons-material/InfoRounded';
import CitySearch, { placeLabel } from './CitySearch.jsx';
import MapView from './MapView.jsx';
import MyWeekend, { DAYS, EMPTY, loadPlan, savePlan, slim } from './MyWeekend.jsx';
import AddRounded from '@mui/icons-material/AddRounded';
import { Ico, btn, btnGhost, card, grid, link, muted, note, noteError, ring, source } from './ui.jsx';

const INTERESTS = [
  ['animals', 'Animals', PetsRounded], ['science', 'Science', ScienceRounded], ['nature', 'Nature', ParkRounded],
  ['arts', 'Arts', PaletteRounded], ['history', 'History', HistoryEduRounded], ['handson', 'Action & Play', SportsHandballRounded],
];
const CAT_ICON = {
  zoo: PetsRounded, aquarium: WaterRounded, childrens_museum: ToysRounded, planetarium: RocketLaunchRounded,
  science_museum: ScienceRounded, indoor_play: ToysRounded, water_park: PoolRounded, theme_park: AttractionsRounded,
  art_museum: PaletteRounded, museum: MuseumRounded, playground: SportsHandballRounded, botanical_garden: LocalFloristRounded,
  nature_reserve: ForestRounded, park: ParkRounded,
};
// Matches both Open-Meteo labels ("Rain showers") and Google descriptions ("Mostly sunny").
const wxIcon = (c = '') =>
  /thunder/i.test(c) ? ThunderstormRounded : /snow|sleet|ice/i.test(c) ? AcUnitRounded
  : /rain|drizzle|shower/i.test(c) ? UmbrellaRounded : /partly|mostly sunny|mostly clear/i.test(c) ? WbCloudyRounded
  : /cloud|overcast|fog|mist|haze/i.test(c) ? CloudRounded : /clear|sunny/i.test(c) ? WbSunnyRounded : ThermostatRounded;

const chip = `inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-2 border-line bg-surface px-4 py-1.5 font-semibold text-ink transition-colors hover:border-accent active:scale-[0.98] motion-reduce:transition-none aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink ${ring}`;
const iconBtn = `grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-line bg-surface text-[24px] text-ink hover:border-accent ${ring}`;
const ONBOARDED = 'fwp-onboarded-v1';
const DEFAULT_ATTRIBUTION = [
  { text: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
  { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/' },
];

// Weekend dates are plain YYYY-MM-DD in the city's calendar
const fmtDay = (ymd, opts = { weekday: 'long', month: 'short', day: 'numeric' }) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
const fmtTime = (iso) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown';
const km = (a, b) => {
  const r = Math.PI / 180, h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
// Price only from source data: the provider's price string, else OSM's fee=yes/no tag. Never guessed.
const priceOf = (f = {}) => f.price || (f.fee === 'no' ? 'Free' : f.fee === 'yes' ? 'Paid entry (amount not listed)' : null);

export default function App() {
  const [city, setCity] = useState(null);
  const [interests, setInterests] = useState([]);
  const [indoorOnly, setIndoorOnly] = useState(false);
  const [plan, setPlan] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | ok | error
  const [error, setError] = useState('');
  const [me, setMe] = useState(null);
  const [route, setRoute] = useState(null); // { id, status: loading | ok | error, data }
  const [focus, setFocus] = useState(null);
  const [dialog, setDialog] = useState(() => { try { return localStorage.getItem(ONBOARDED) ? null : 'onboarding'; } catch { return 'onboarding'; } });
  const [retry, setRetry] = useState(0);
  const [mine, setMine] = useState(EMPTY); // My weekend builder
  const [tab, setTab] = useState("plan"); // mobile tabs: plan | map | info
  const reqId = useRef(0);
  const routeCtrl = useRef(null);
  const retrying = useRef(false);

  // One plan request per (city, interests). A section "Try again" re-runs it but keeps the current plan on screen
  // (server caches healthy sources, so only the failed one refetches).
  useEffect(() => {
    if (!city) return;
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setState(retrying.current ? 'refreshing' : 'loading');
    retrying.current = false;
    const qs = new URLSearchParams({ lat: city.lat, lon: city.lon, tz: city.timezone, name: city.name, interests: interests.join(',') });
    if (indoorOnly) qs.set('indoor', '1');
    if (me) qs.set('from', `${me.lat},${me.lon}`); // server ranks by distance from you when within 50 km of the city
    fetch(`/api/plan?${qs}`, { signal: ctrl.signal })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'The planner is unavailable right now.'); return d; })
      .then((d) => { if (id === reqId.current) { setPlan(d); setState('ok'); } })
      .catch((e) => { if (e.name !== 'AbortError' && id === reqId.current) { setError(e.message); setState('error'); } });
    return () => ctrl.abort();
  }, [city, interests, indoorOnly, retry, me]);

  const toggle = (key) => setInterests((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);
  const clearRoute = () => { routeCtrl.current?.abort(); setRoute(null); };
  const pickCity = (c) => { clearRoute(); setPlan(null); setCity(c); };
  const startOver = () => { clearRoute(); setPlan(null); setCity(null); setState('idle'); };
  const loading = state === 'loading';
  const current = state === 'ok' || state === 'refreshing' ? plan : null; // never show a previous city's plan under a new heading
  const retryCtl = { refreshing: state === 'refreshing', onRetry: () => { retrying.current = true; setRetry((n) => n + 1); } };

  // Route start: the user's own location when it's near this city, otherwise the clearly labelled city centre.
  const start = city && (me && km(me, city) <= 50
    ? { lat: me.lat, lon: me.lon, label: 'your location', mine: true }
    : { lat: city.lat, lon: city.lon, label: `the centre of ${city.name}` });

  useEffect(() => { setMine(city ? loadPlan(city) : EMPTY); }, [city?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const edit = (fn) => setMine((cur) => { const next = fn(cur); if (city) savePlan(city, next); return next; });

  const showRoute = (v, from = start) => {
    routeCtrl.current?.abort();
    const ctrl = routeCtrl.current = new AbortController();
    setRoute({ id: v.id, status: 'loading' });
    setFocus({ id: v.id });
    fetch(`/api/route?from=${from.lat},${from.lon}&to=${v.lat},${v.lon}`, { signal: ctrl.signal })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.geometry?.length) throw new Error(); setRoute({ id: v.id, status: 'ok', data: d, from: from.label, name: v.name }); })
      .catch((e) => { if (e.name !== 'AbortError') setRoute({ id: v.id, status: 'error' }); });
  };

  // Map markers share their label with the card badge: 1-2 weekend picks, 3+ other options (outlined), D dinner.
  const groups = useMemo(() => {
    if (!current) return null;
    const a = current.activities, r = current.restaurant;
    const items = a.items || [], more = a.more || [], diff = a.different ? [a.different] : [];
    return {
      items: items.map((v, i) => ({ v, marker: String(i + 1) })),
      more: more.map((v, i) => ({ v, marker: String(items.length + i + 1), secondary: true })),
      different: diff.map((v) => ({ v, marker: String(items.length + more.length + 1), secondary: true })),
      dinner: r.item ? [{ v: r.item, marker: 'D' }] : [],
      alternatives: (r.alternatives || []).map((v) => ({ v, marker: 'D', secondary: true })),
    };
  }, [current]);
  const points = useMemo(() => !groups ? [] : Object.values(groups).flat().map(({ v, marker, secondary }) => ({
    id: v.id, marker, secondary, lat: v.lat, lon: v.lon, name: v.name, photo: photoUrl(v),
    label: marker === 'D' ? 'Italian dinner' : [v.category?.label, v.day && fmtDay(v.day, { weekday: 'long' })].filter(Boolean).join(', '),
  })), [groups]);
  const routeLine = route?.status === 'ok' ? route.data.geometry : null;

  const closeDialog = () => {
    if (dialog === 'onboarding') {
      try { localStorage.setItem(ONBOARDED, '1'); } catch { /* storage blocked: onboarding just shows again next visit */ }
      document.querySelector('[role=combobox]')?.focus();
    }
    setDialog(null);
  };
  const menu = { onHow: () => setDialog('onboarding'), onSources: () => setDialog('sources'), onReset: startOver };
  // Directions: draw the in-app route; on mobile jump to the Map tab where the route and its summary are shown.
  const directions = (v, from) => { showRoute(v, from); if (window.matchMedia('(max-width: 767px)').matches) setTab('map'); };
  const without = (p, id) => ({ sat: p.sat.filter((x) => x.id !== id), sun: p.sun.filter((x) => x.id !== id) });
  const dayOf = (id) => mine.sat.some((x) => x.id === id) ? 'sat' : mine.sun.some((x) => x.id === id) ? 'sun' : null;
  // Toggle: adding to the day it is already on removes it; adding to the other day moves it.
  const onAdd = (v, k) => edit((p) => { const was = p.sat.some((x) => x.id === v.id) ? 'sat' : p.sun.some((x) => x.id === v.id) ? 'sun' : null; const n = without(p, v.id); return was === k ? n : { ...n, [k]: [...n[k], slim(v)] }; });
  const planOps = {
    move: (k, i, d) => edit((p) => { const a = [...p[k]], j = i + d; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return { ...p, [k]: a }; }),
    swap: (k, i) => edit((p) => { const o = k === 'sat' ? 'sun' : 'sat'; return { ...p, [k]: p[k].filter((_, x) => x !== i), [o]: [...p[o], p[k][i]] }; }),
    remove: (k, i) => edit((p) => ({ ...p, [k]: p[k].filter((_, x) => x !== i) })),
    // Deterministic, verified picks only: Saturday activity then the main dinner pick; Sunday activity.
    suggest: () => { const it = current?.activities?.items || []; const sat = it.find((v) => v.day === current.weekend.saturday), sun = it.find((v) => v.day === current.weekend.sunday); edit(() => ({ sat: [sat, current.restaurant?.item].filter(Boolean).map(slim), sun: [sun].filter(Boolean).map(slim) })); },
    canSuggest: !!current,
  };
  const venueProps = { dayOf, onAdd, start, route, onRoute: directions, onFocus: (v) => setFocus({ id: v.id }) };
  const filters = { interests, toggle, indoorOnly, setIndoorOnly, clear: () => { setInterests([]); setIndoorOnly(false); } };
  const routeVenue = route && points.find((p) => p.id === route.id);
  const navH = 'calc(4rem + env(safe-area-inset-bottom))';

  return (
    <>
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[2000] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2" href="#results">Skip to results</a>

      {/* Search bar: sticky top of the Plan tab on mobile, floating top-left over the map on desktop. */}
      <div className={`${tab === 'plan' ? 'flex' : 'hidden'} sticky top-0 z-[1001] items-center gap-2 border-b border-line bg-page px-3 py-2 md:fixed md:left-4 md:top-4 md:flex md:rounded-2xl md:border md:bg-surface md:p-2 md:shadow-card`}>
        <Menu {...menu} className="relative hidden md:block" />
        <div className="min-w-0 flex-1 md:w-[min(520px,45vw)] md:flex-none"><CitySearch onSelect={pickCity} /></div>
        <LocateMe onLocate={setMe} onConfirm={pickCity} />
        <Filters {...filters} />
      </div>

      <MapView city={city} points={points} me={me} route={routeLine} focus={focus}
        className={`${tab === 'map' ? 'block' : 'hidden'} fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 md:block`} />

      {tab === 'map' && route && (
        <div className="fixed inset-x-3 z-[1000] md:hidden" style={{ bottom: `calc(${navH} + 0.75rem)` }} aria-live="polite">
          <RouteSummary route={route} name={route.name || routeVenue?.name} />
        </div>
      )}

      <main id="results" aria-busy={loading} aria-labelledby="recs-title"
        className={`${tab === 'plan' ? 'block' : 'hidden'} px-3 pb-28 pt-4 md:fixed md:right-4 md:top-24 md:z-[1000] md:block md:max-h-[calc(100dvh-7rem)] md:w-[min(440px,42vw)] md:overflow-y-auto md:rounded-2xl md:bg-page md:p-4 md:shadow-card xl:top-4 xl:max-h-[calc(100dvh-2rem)]`}>
        <h2 id="recs-title" className="mb-3 flex items-center gap-2 text-[.95rem] font-extrabold uppercase tracking-wide text-muted">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-[20px] text-accent-ink"><Ico as={FamilyRestroomRounded} /></span> Recommendations
        </h2>
        <div>
          {!city && (
            <section>
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight">Plan a weekend your kids will love</h1>
              <p className="mt-2 text-lg text-muted">Pick a city. We check the forecast, find outings for ages 4-8, and suggest Italian dinner.</p>
              <p className={`${note} mt-4`}><Ico as={TravelExploreRounded} className="mt-0.5 text-[20px] text-accent" /><span>Search for a city above. Your choices below shape the recommendations, and you can change them any time.</span></p>
              <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
                <FilterFields {...filters} idPrefix="home" />
              </div>
            </section>
          )}
          {city && (
            <>
              <section aria-live="polite">
                <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{city.name}</h1>
                <p className="text-lg text-muted">{placeLabel(city)}</p>
                {current ? (
                  <div className="mt-3 grid gap-2">
                    <p className="flex items-center gap-2 font-bold"><Ico as={EventRounded} className="text-[22px] text-accent" /> {fmtDay(current.weekend.saturday)} and {fmtDay(current.weekend.sunday)}</p>
                    <p className="flex items-start gap-2 text-muted"><Ico as={ScheduleRounded} className="mt-0.5 text-[22px]" /> Local time: {current.weekend.localTime} ({current.weekend.timezone})</p>
                    <p className="flex flex-wrap items-center gap-x-2">
                      <span className="text-muted">Personalized for:</span>
                      <strong>{[...filters.interests.map((k) => INTERESTS.find(([key]) => key === k)?.[1]), filters.indoorOnly && 'Indoors only'].filter(Boolean).join(', ') || 'no preferences (general picks for ages 4-8)'}</strong>
                      <button type="button" className={link} onClick={() => { setTab?.('plan'); document.getElementById('filters-btn')?.click(); }}>Edit</button>
                    </p>
                  </div>
                ) : <p className="mt-3 text-muted">{loading ? 'Finding the best options for your weekend. This can take up to 20 seconds for a new city.' : ' '}</p>}
              </section>

              {current && <MyWeekend plan={mine} weekend={current.weekend} city={city} ops={planOps} dates={{ sat: fmtDay(current.weekend.saturday, { month: 'short', day: 'numeric' }), sun: fmtDay(current.weekend.sunday, { month: 'short', day: 'numeric' }) }}
                onLeg={(prev, v) => directions(v, { lat: prev.lat, lon: prev.lon, label: prev.name })} />}

              {state === 'error' && <div className={`${noteError} mt-4`} role="alert"><Ico as={ErrorOutlineRounded} className="mt-0.5 text-[20px]" /><span>{error} <button type="button" className={link} onClick={() => setCity({ ...city })}>Try again</button></span></div>}

              <Section title="Weekend forecast" icon={WbSunnyRounded}>
                {loading || !current ? (state === 'error' ? null : <Skeletons n={2} h="min-h-[150px]" />) : <Forecast weather={current.weather} {...retryCtl} />}
              </Section>

              <Section title="Things to do" icon={PlaceRounded}>
                {loading || !current ? (state === 'error' ? null : <Skeletons n={2} h="min-h-[300px]" />) : <Activities a={current.activities} g={groups} {...venueProps} {...retryCtl} />}
              </Section>

              <Section title="Italian dinner ideas" icon={RestaurantRounded}>
                {loading || !current ? (state === 'error' ? null : <Skeletons n={1} h="min-h-[220px]" />) : <Dining r={current.restaurant} g={groups} {...venueProps} {...retryCtl} />}
              </Section>
            </>
          )}
        </div>
      </main>

      {/* Mobile Info tab replaces the desktop menu. */}
      <section aria-label="Info" className={`${tab === 'info' ? 'block' : 'hidden'} px-4 pb-28 pt-6 md:hidden`}>
        <h1 className="text-3xl font-extrabold tracking-tight">Info</h1>
        <div className="mt-5 grid gap-3">
          <button type="button" className={`${btnGhost} justify-start`} onClick={() => setDialog('onboarding')}><Ico as={TravelExploreRounded} className="text-[20px] text-accent" /> How it works</button>
          <button type="button" className={`${btnGhost} justify-start`} onClick={() => { startOver(); setTab('plan'); }}><Ico as={HomeRounded} className="text-[20px] text-accent" /> Start over</button>
        </div>
        <SourcesText list={current?.attribution} />
      </section>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[1100] grid grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {[['plan', 'Plan', HomeRounded], ['map', 'Map', MapRounded], ['info', 'Info', InfoRounded]].map(([key, label, icon]) => (
          <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}
            className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 text-[.8rem] font-bold ${tab === key ? 'text-accent' : 'text-muted'} ${ring}`}>
            <Ico as={icon} className="text-[26px]" /> {label}
          </button>
        ))}
      </nav>

      <Dialog open={dialog === 'onboarding'} onClose={closeDialog} label="How the planner works"><Onboarding onDone={closeDialog} /></Dialog>
      <Dialog open={dialog === 'sources'} onClose={closeDialog} label="Data sources">
        <SourcesText list={current?.attribution} />
        <div className="mt-5 flex justify-end"><button type="button" className={btn} onClick={closeDialog}>Close</button></div>
      </Dialog>
    </>
  );
}

const SourcesText = ({ list }) => (
  <div className="mt-6">
    <h2 className="text-xl font-extrabold">Data sources</h2>
    <p className="mt-2">Places come from Google Places when available, otherwise OpenStreetMap. Forecasts come from Google Weather or Open-Meteo. Routes are estimates from OpenStreetMap routing.</p>
    <p className="mt-2 text-muted">Opening hours, prices and accessibility are shown exactly as the source lists them. Check the listing before you go.</p>
    <div className="mt-3"><Attribution list={list} /></div>
  </div>
);

function RouteSummary({ route, name }) {
  if (route.status === 'loading') return <p className={`${note} bg-surface shadow-card`}><Ico as={RouteRounded} className="mt-0.5 text-[20px] text-accent" /><span>Finding a route{name ? ` to ${name}` : ''}…</span></p>;
  if (route.status === 'error') return <p className={`${noteError} shadow-card`}><Ico as={ErrorOutlineRounded} className="mt-0.5 text-[20px]" /><span>Route unavailable right now, use Google Maps instead.</span></p>;
  return (
    <p className={`${note} bg-surface shadow-card`}><Ico as={RouteRounded} className="mt-0.5 text-[20px] text-accent" />
      <span>{name && <strong className="block">{name}</strong>}About {Math.round(route.data.durationMin)} min by car, {route.data.distanceKm} km, from {route.from}. Estimate from OpenStreetMap routing.</span></p>
  );
}

// The preference controls themselves; shown inline on the homepage and inside the filter popover.
function FilterFields({ interests, toggle, indoorOnly, setIndoorOnly, idPrefix = 'f' }) {
  const chipSm = `inline-flex min-h-10 w-full cursor-pointer items-center gap-1.5 rounded-full border-2 border-line bg-surface px-3 text-left text-[.95rem] font-semibold text-ink hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink ${ring}`;
  return (
    <>
      <fieldset className="m-0 border-0 p-0">
        <legend className="p-0 font-bold">What do your kids enjoy?</legend>
        <p className="mb-3 text-[.85rem] text-muted">Optional, ages 4-8</p>
        <div className="grid grid-cols-2 gap-2">
          {INTERESTS.map(([key, label, icon]) => {
            const on = interests.includes(key);
            return (
              <button key={key} type="button" className={chipSm} aria-pressed={on} onClick={() => toggle(key)}>
                <Ico as={on ? CheckRounded : icon} className="text-[20px]" /> <span className="min-w-0 truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <hr className="my-4 border-line" />
      <div className="flex items-center justify-between gap-3">
        <span id={`${idPrefix}-indoor-label`}>
          <span className="block font-bold">Indoors only</span>
          <span className="block text-[.85rem] text-muted">Only places whose listing confirms they're indoors</span>
        </span>
        <button type="button" role="switch" aria-checked={indoorOnly} aria-labelledby={`${idPrefix}-indoor-label`} onClick={() => setIndoorOnly((x) => !x)}
          className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors motion-reduce:transition-none ${indoorOnly ? 'border-accent bg-accent' : 'border-line bg-surface-2'} ${ring}`}>
          <span aria-hidden="true" className={`absolute top-0.5 size-5 rounded-full bg-surface shadow-card transition-[left] motion-reduce:transition-none ${indoorOnly ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
    </>
  );
}

function Filters({ interests, toggle, indoorOnly, setIndoorOnly, clear }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const count = interests.length + (indoorOnly ? 1 : 0);
  const close = () => { setOpen(false); btnRef.current?.focus(); };
  // The wrapper is not positioned, so the popover anchors to the search bar (sticky on mobile, fixed on desktop):
  // full-width sheet on mobile; on desktop it starts at the bar's left edge and is capped to stop short of the
  // Recommendations panel (min(440px,42vw) wide + gutters).
  return (
    <div onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) close(); }}>
      <button ref={btnRef} id="filters-btn" type="button" className={`${iconBtn} relative`} aria-expanded={open} aria-controls="filters"
        aria-label={count ? `Filters, ${count} active` : 'Filters'} onClick={() => setOpen((o) => !o)}>
        <Ico as={TuneRounded} />
        {count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[.7rem] font-extrabold text-accent-ink">{count}</span>}
      </button>
      {open && (
        <div id="filters" role="group" aria-label="Filters"
          className="absolute inset-x-3 top-[calc(100%+8px)] z-[1100] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-card md:inset-x-auto md:left-0 md:w-[360px] md:max-w-[calc(100vw-min(440px,42vw)-3rem)]">
          <FilterFields interests={interests} toggle={toggle} indoorOnly={indoorOnly} setIndoorOnly={setIndoorOnly} idPrefix="pop" />
          <div className="mt-4 flex items-center justify-between">
            <button type="button" className={link} onClick={clear} disabled={!count}>Clear</button>
            <button type="button" className={`${btn} min-h-10 py-1.5`} onClick={close}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

const Attribution = ({ list }) => (
  <p className="flex flex-wrap gap-x-4 gap-y-1">{(list || DEFAULT_ATTRIBUTION).map((a) => <a key={a.url} className={link} href={a.url} target="_blank" rel="noreferrer">{a.text}</a>)}</p>
);

function Menu({ onHow, onSources, onReset, className = '', alignRight }) {
  const [open, setOpen] = useState(false);
  const item = `block w-full cursor-pointer rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-surface-2 ${ring}`;
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <div className={className} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button type="button" className={`${iconBtn} shadow-card`} aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Ico as={MenuRounded} />
      </button>
      {open && (
        <div className={`absolute top-[calc(100%+8px)] z-[1100] w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-card ${alignRight ? 'right-0' : 'left-0'}`}>
          <button type="button" className={item} onClick={run(onHow)}>How it works</button>
          <button type="button" className={item} onClick={run(onSources)}>Data sources</button>
          <button type="button" className={item} onClick={run(onReset)}>Start over</button>
        </div>
      )}
    </div>
  );
}

// Native modal dialog: focus trap, Escape and backdrop come from the browser.
function Dialog({ open, onClose, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-label={label} onClose={() => open && onClose()}
      className="m-auto w-[min(460px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-6 text-ink shadow-card backdrop:bg-ink/50">
      {open && children}
    </dialog>
  );
}

const STEPS = [
  [TravelExploreRounded, 'Choose a city', 'Search any city in the world, or use your location to start close to home.'],
  [FavoriteRounded, 'Tell us what your kids enjoy', 'Pick a few interests or skip them. Every plan is made for ages 4-8.'],
  [MapRounded, 'Follow the map', 'See your outings and Italian dinner ideas on the map, with routes from where you are.'],
];

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [icon, title, text] = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="grid gap-4">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-[40px] text-accent"><Ico as={icon} /></span>
      <p className="text-[.9rem] font-bold text-accent">Step {step + 1} of {STEPS.length}</p>
      <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
      <p className="text-lg text-muted">{text}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {!last ? <button type="button" className={link} onClick={onDone}>Skip</button> : <span />}
        <div className="flex gap-2">
          {step > 0 && <button type="button" className={btnGhost} onClick={() => setStep(step - 1)}>Back</button>}
          <button type="button" className={btn} autoFocus onClick={() => last ? onDone() : setStep(step + 1)}>{last ? 'Start planning' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

function LocateMe({ onLocate, onConfirm }) {
  const [msg, setMsg] = useState('');
  const [suggest, setSuggest] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!window.isSecureContext || !navigator.geolocation) return null; // browsers only allow geolocation over HTTPS

  const locate = () => {
    setBusy(true); setMsg(''); setSuggest(null);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      onLocate({ lat: coords.latitude, lon: coords.longitude });
      try {
        const r = await fetch(`/api/reverse?lat=${coords.latitude}&lon=${coords.longitude}`);
        const d = await r.json();
        if (!r.ok || !d?.name) throw new Error();
        setSuggest(d);
      } catch { setMsg('We couldn’t match your location to a city. Please search instead.'); }
      setBusy(false);
    }, (err) => {
      setMsg(err.code === 1 ? 'Location access was declined. No problem, just search for your city.' : 'We couldn’t get your location. Please search instead.');
      setBusy(false);
    }, { timeout: 10000, maximumAge: 600000 });
  };

  return (
    <div className="relative">
      <button type="button" className={iconBtn} onClick={locate} disabled={busy} aria-label="Use my location" title="Use my location">
        <Ico as={MyLocationRounded} className={`text-accent ${busy ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
      </button>
      <div aria-live="polite" className={suggest || msg ? 'absolute right-0 top-[calc(100%+8px)] z-[1100] w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface p-4 shadow-card md:left-0 md:right-auto' : 'sr-only'}>
        {suggest && (
          <div className="grid gap-3">
            <span>Near <strong>{suggest.name}</strong>, {placeLabel(suggest)}?</span>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={btn} onClick={() => { onConfirm(suggest); setSuggest(null); }}>Plan for {suggest.name}</button>
              <button type="button" className={link} onClick={() => setSuggest(null)}>Not right</button>
            </div>
          </div>
        )}
        {msg && <p className="text-muted">{msg} <button type="button" className={link} onClick={() => setMsg('')}>OK</button></p>}
      </div>
    </div>
  );
}

const Section = ({ title, icon, children }) => (
  <section className="mt-8">
    <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold tracking-tight"><Ico as={icon} className="text-[26px] text-accent" /> {title}</h2>
    {children}
  </section>
);

const Skeletons = ({ n, h }) => (
  <div className={grid} aria-hidden="true">
    {Array.from({ length: n }, (_, i) => <div key={i} className={`animate-pulse rounded-2xl border border-line bg-surface-2 motion-reduce:animate-none ${h}`} />)}
  </div>
);

const Note = ({ children }) => <p className={`${note} mb-4`}><Ico as={InfoOutlined} className="mt-0.5 text-[20px] text-accent" /><span>{children}</span></p>;
// API section status: ok | partial | unverified | unavailable ('error' from older responses = unavailable).
const isDown = (s) => s.status === 'unavailable' || s.status === 'error';
function Status({ s, onRetry, refreshing }) {
  if (isDown(s)) return (
    <div className={`${noteError} mb-4`} role="status">
      <Ico as={ErrorOutlineRounded} className="mt-0.5 text-[20px]" />
      <span>{s.message || 'This section is unavailable right now.'}{' '}
        <button type="button" className={link} onClick={onRetry} disabled={refreshing}>{refreshing ? 'Trying again…' : 'Try again'}</button></span>
    </div>
  );
  return (s.status === 'partial' || s.status === 'unverified') && s.message ? <Note>{s.message}</Note> : null;
}
const SourceLine = ({ name, url, at }) => (
  <p className={source}>Source: {url ? <a className={link} href={url} target="_blank" rel="noreferrer">{name}</a> : name}, retrieved {fmtTime(at)}</p>
);

function Forecast({ weather, onRetry, refreshing }) {
  if (isDown(weather)) return <Status s={weather} onRetry={onRetry} refreshing={refreshing} />;
  return (
    <>
      <Status s={weather} />
      <div className={grid}>
        {weather.days.map((d) => (
          <article key={d.date} className={card}>
            <h3 className="text-lg font-extrabold">{fmtDay(d.date, { weekday: 'long' })}<span className={muted}> {fmtDay(d.date, { month: 'short', day: 'numeric' })}</span></h3>
            {d.available ? (
              <div className="flex items-center gap-4">
                <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-accent-soft text-[40px] text-accent"><Ico as={wxIcon(d.condition)} /></span>
                <div className="grid gap-0.5">
                  <p className="text-lg font-bold">{d.condition}</p>
                  <p><span className="text-2xl font-extrabold">{Math.round(d.max)}{d.unit}</span> <span className="text-muted">high</span> <span className="ml-2 font-bold">{Math.round(d.min)}{d.unit}</span> <span className="text-muted">low</span></p>
                  {/* 0 and "not reported" are different facts: compare with == null, never truthiness */}
                  <p className="flex items-center gap-1 text-muted"><Ico as={WaterDropRounded} className="text-[18px] text-accent" />
                    Chance of rain or snow: {d.precipProb == null ? 'not reported' : `${d.precipProb}%`}</p>
                  <p className="pl-[22px] text-muted">Amount: {d.precipSum == null ? 'not reported' : `${d.precipSum} ${weather.units?.precip || 'mm'}`}</p>
                </div>
              </div>
            ) : <p className="text-muted">Forecast unavailable for this day</p>}
          </article>
        ))}
      </div>
      <div className="mt-3"><SourceLine name={weather.source || 'Weather provider'} url={weather.sources?.[0]?.url} at={weather.fetchedAt} /></div>
    </>
  );
}

const tag = 'rounded-full bg-surface-2 px-3 py-0.5 text-[.85rem] font-bold text-ink';

function VenueHead({ icon, v, marker, secondary, onFocus }) {
  return (
    <div className="flex items-start gap-3">
      <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-[28px] text-accent">
        <Ico as={icon} />
        <span aria-hidden="true" className={`absolute -right-1.5 -top-1.5 grid size-6 place-items-center border-2 text-xs font-extrabold ${marker === 'D' ? 'rounded-lg' : 'rounded-full'} ${
          secondary ? 'border-accent bg-surface text-accent' : marker === 'D' ? 'border-ink bg-ink text-page' : 'border-accent bg-accent text-accent-ink'}`}>{marker}</span>
      </span>
      <div className="min-w-0">
        {v.day && <p className="flex items-center gap-1 text-[.9rem] font-bold text-accent"><Ico as={EventRounded} className="text-[18px]" /> {fmtDay(v.day, { weekday: 'long' })}</p>}
        <h3 className="text-xl font-extrabold leading-snug">
          <button type="button" className={`cursor-pointer text-left hover:underline ${ring} rounded`} onClick={() => onFocus(v)} title="Show on map">{v.name}</button>
        </h3>
        {v.nameEn && <p className="text-muted">{v.nameEn}</p>}
      </div>
    </div>
  );
}

// "Why this fits" adds a budget line only when the source gives a price.
const PriceWhy = ({ f }) => {
  const p = priceOf(f);
  if (!p) return null;
  return <li className="flex gap-2"><Ico as={PaymentsRounded} className="mt-0.5 text-[20px] text-accent" /> {/^free/i.test(p) ? 'Free entry keeps it easy on the budget.' : `Price: ${p}.`}</li>;
};

// Same-origin photo proxy only; anything else (or a failed load) renders nothing, never a broken-image box.
const photoUrl = (v) => { const u = v.facts?.photo?.url; return typeof u === 'string' && u.startsWith('/api/photo?') ? u : null; };
function Photo({ v }) {
  const [failed, setFailed] = useState(false);
  const url = photoUrl(v), p = v.facts?.photo;
  if (!url || failed) return null;
  const author = p.author && (/^https?:\/\//.test(p.authorUrl || '')
    ? <a className={link} href={p.authorUrl} target="_blank" rel="noreferrer">{p.author}</a> : p.author);
  return (
    <figure className="m-0 grid gap-1">
      <img src={url} alt={`Photo of ${v.name}`} loading="lazy" decoding="async" onError={() => setFailed(true)}
        className="aspect-video w-full rounded-xl bg-surface-2 object-cover" />
      {/* Google requires showing the photo author's attribution. */}
      <figcaption className="text-[.78rem] text-muted">{author ? <>Photo: {author} via Google</> : 'Photo via Google'}</figcaption>
    </figure>
  );
}

function DayToggles({ v, dayOf, onAdd }) {
  if (!onAdd) return null;
  const d = dayOf(v.id);
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(DAYS).map(([k, day]) => (
        <button key={k} type="button" aria-pressed={d === k} onClick={() => onAdd(v, k)}
          className={`inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-full border-2 border-line bg-surface px-3 py-1 text-[.88rem] font-bold text-ink hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink ${ring}`}>
          <Ico as={d === k ? CheckRounded : AddRounded} className="text-[18px]" /> {d === k ? 'Added' : 'Add'} to {day}
        </button>
      ))}
    </div>
  );
}

// One card for every venue. Activities carry why {ages, interest, weather}; restaurants carry a why string.
function VenueCard({ v, marker, secondary, icon, sectionSource, ...rest }) {
  const w = typeof v.why === 'string' ? { place: v.why } : (v.why || {});
  const line = (I, text) => text && <li className="flex gap-2"><Ico as={I} className="mt-0.5 text-[20px] text-accent" /> {text}</li>;
  return (
    <article className={card}>
      <Photo v={v} />
      <VenueHead icon={icon || CAT_ICON[v.category?.key] || PlaceRounded} v={v} marker={marker} secondary={secondary} onFocus={rest.onFocus} />
      {(v.category?.label || v.category?.indoor != null) && (
        <p className="flex flex-wrap gap-1.5">{v.category?.label && <span className={tag}>{v.category.label}</span>}{v.category?.indoor != null && <span className={tag}>{v.category.indoor ? 'Indoors' : 'Outdoors'}</span>}</p>
      )}
      <div className="rounded-xl bg-accent-soft px-4 py-3">
        <h4 className="mb-2 font-extrabold">Why this fits</h4>
        <ul className="m-0 grid list-none gap-2 p-0">
          {line(PlaceRounded, w.place)}
          {line(ChildCareRounded, w.ages)}
          {line(FavoriteRounded, w.interest)}
          {line(WbSunnyRounded, w.weather)}
          <PriceWhy f={v.facts} />
        </ul>
      </div>
      <PlanFacts v={v} />
      <DayToggles v={v} dayOf={rest.dayOf} onAdd={rest.onAdd} />
      <Actions v={v} sectionSource={sectionSource} {...rest} />
    </article>
  );
}

const SubHeading = ({ children }) => <h3 className="mb-3 mt-6 text-lg font-extrabold">{children}</h3>;

function Activities({ a, g, onRetry, refreshing, ...rest }) {
  if (isDown(a)) return <Status s={a} onRetry={onRetry} refreshing={refreshing} />;
  const cards = (list) => <div className={grid}>{list.map((x) => <VenueCard key={x.v.id} {...x} sectionSource={a.source} {...rest} />)}</div>;
  return (
    <>
      <Status s={a} />
      {a.note && a.note !== a.message && <Note>{a.note}</Note>}
      {cards(g.items)}
      {g.more.length > 0 && <><SubHeading>More options</SubHeading>{cards(g.more)}</>}
      {g.different.length > 0 && <><SubHeading>Something different</SubHeading>{g.different[0].v.why?.interest && <p className="mb-3 text-muted">{g.different[0].v.why.interest}</p>}{cards(g.different)}</>}
    </>
  );
}

function Dining({ r, g, onRetry, refreshing, ...rest }) {
  if (isDown(r)) return <Status s={r} onRetry={onRetry} refreshing={refreshing} />;
  if (!r.item) return <Note>{r.message || r.note || "We couldn't verify a suitable Italian restaurant in this city."}</Note>;
  return (
    <>
      <Status s={r} />
      <div className={grid}>
        {[...g.dinner, ...g.alternatives].map((x) => <VenueCard key={x.v.id} {...x} icon={RestaurantRounded} sectionSource={r.source} {...rest} />)}
      </div>
    </>
  );
}

// Source facts only, shown as the provider lists them and never filled in.
function PlanFacts({ v }) {
  const f = v.facts || {};
  const join = (x) => Array.isArray(x) && x.length ? x.join(', ') : null;
  const rows = [
    [PlaceRounded, 'Location', <>{v.address || 'Street address not listed (see map)'}<span className="block text-[.9rem] text-muted">{v.distanceKm} km from {v.distanceFrom === 'you' ? 'you' : 'the city centre'}</span></>],
    [PaymentsRounded, 'Price', priceOf(f) || 'Price not listed, check the website'],
    [ScheduleRounded, 'Hours', f.hoursForDay || (f.openingHours && <>{f.openingHours} <span className="text-muted">(may be out of date)</span></>)],
    [StarRounded, 'Rating', f.rating != null && `${f.rating}${f.ratingCount ? ` (${f.ratingCount.toLocaleString()} Google reviews)` : ''}`],
    [ChildCareRounded, 'For families', join(f.familyFeatures) || join((f.kidFriendlyTags || []).map((t) => t.replace(/_/g, ' ')))],
    [AccessibleRounded, 'Accessibility', join(f.accessibility) || (f.wheelchair && `Wheelchair access: ${f.wheelchair}`)],
    [LocalParkingRounded, 'Parking', join(f.parking)],
    [RestaurantRounded, 'Cuisine', f.cuisine && f.cuisine.replace(/;/g, ', ').replace(/_/g, ' ')],
  ].filter(([, , val]) => val);
  return (
    <div>
      <h4 className="mb-2 font-extrabold">Plan your visit</h4>
      <dl className="m-0 grid gap-2">
        {rows.map(([icon, label, val]) => (
          <div key={label} className="flex gap-2">
            <Ico as={icon} className="mt-0.5 text-[20px] text-muted" />
            <div><dt className="sr-only">{label}</dt><dd><span className="font-semibold">{label}: </span>{val}</dd></div>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Actions({ v, sectionSource, start, route, onRoute }) {
  const mine = route?.id === v.id ? route : null;
  const gmaps = `https://www.google.com/maps/dir/?api=1${start?.mine ? `&origin=${start.lat},${start.lon}` : ''}&destination=${v.lat},${v.lon}`;
  return (
    <div className="mt-auto grid gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[.9rem]">
          <a className={`${link} inline-flex items-center gap-1`} href={gmaps} target="_blank" rel="noreferrer"><Ico as={OpenInNewRounded} className="text-[16px]" /> Open in Google Maps</a>
          {v.sourceUrl && <a className={`${link} inline-flex items-center gap-1`} href={v.sourceUrl} target="_blank" rel="noreferrer"><Ico as={OpenInNewRounded} className="text-[16px]" /> View listing</a>}
          {v.facts?.website && <a className={`${link} inline-flex items-center gap-1`} href={v.facts.website} target="_blank" rel="noreferrer"><Ico as={LanguageRounded} className="text-[16px]" /> Official site</a>}
        </div>
        <button type="button" className={`${btn} ml-auto`} onClick={() => onRoute(v)} disabled={mine?.status === 'loading'}>
          <Ico as={RouteRounded} className="text-[20px]" /> {mine?.status === 'loading' ? 'Finding route…' : 'Directions'}
        </button>
      </div>
      <div aria-live="polite">
        {mine?.status === 'ok' && <p className={`${note} text-[.95rem]`}><Ico as={RouteRounded} className="mt-0.5 text-[20px] text-accent" /><span>About {Math.round(mine.data.durationMin)} min by car, {mine.data.distanceKm} km, from {mine.from}. Estimate from OpenStreetMap routing.</span></p>}
        {mine?.status === 'error' && <p className={`${noteError} text-[.95rem]`}><Ico as={ErrorOutlineRounded} className="mt-0.5 text-[20px]" /><span>Route unavailable right now, use Google Maps instead.</span></p>}
      </div>
      <SourceLine name={v.source || sectionSource || 'Listing'} url={v.sourceUrl} at={v.retrievedAt} />
    </div>
  );
}
