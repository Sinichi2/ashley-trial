import { useState } from 'react';
import EventNoteRounded from '@mui/icons-material/EventNoteRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import { Ico, btn, btnGhost, card, link, note, noteError, ring } from './ui.jsx';

export const DAYS = { sat: 'Saturday', sun: 'Sunday' };
export const EMPTY = { sat: [], sun: [] };

// Per-city plan in localStorage; every access guarded so the builder still works when storage is blocked.
const key = (c) => `fwp-plan-v1:${c.id}`;
export const loadPlan = (c) => {
  try { const s = JSON.parse(localStorage.getItem(key(c))); return s && Array.isArray(s.sat) && Array.isArray(s.sun) ? s : EMPTY; } catch { return EMPTY; }
};
export const savePlan = (c, p) => { try { localStorage.setItem(key(c), JSON.stringify(p)); } catch { /* plan lasts this session only */ } };
// Only what the plan and calendar need.
export const slim = (v) => ({
  id: v.id, name: v.name, lat: v.lat, lon: v.lon, address: v.address || null, sourceUrl: v.sourceUrl || null,
  category: v.category?.label ? { label: v.category.label } : typeof v.why === 'string' ? { label: 'Italian restaurant' } : null,
  facts: { weekdayHours: v.facts?.weekdayHours || null },
});
// Listed hours for one weekday, from the provider's weekday lines ("Saturday: 10:00 AM to 6:00 PM").
export const hoursFor = (v, day) => {
  const e = (v.facts?.weekdayHours || []).find((s) => typeof s === 'string' && s.toLowerCase().startsWith(day.toLowerCase()));
  return e ? e.replace(/^[^:]+:\s*/, '').replace(/\s*[\u2013\u2014]\s*/g, ' to ').replace(/[\u202f\u2009]/g, ' ') : null;
};

// RFC 5545: escape text, CRLF line endings, fold long lines.
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (l) => l.length <= 75 ? l : l.slice(0, 75) + l.slice(75).match(/.{1,74}/g).map((x) => `\r\n ${x}`).join('');
const plusDay = (d) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10).replace(/-/g, ''); };
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
export function buildIcs(plan, weekend) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = [];
  for (const [k, day] of Object.entries(DAYS)) {
    const date = k === 'sat' ? weekend.saturday : weekend.sunday;
    for (const v of plan[k]) {
      const h = hoursFor(v, day);
      events.push('BEGIN:VEVENT', `UID:${uid()}@family-weekend-planner`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${plusDay(date)}`, `SUMMARY:${esc(v.name)}`,
        ...(v.address ? [`LOCATION:${esc(v.address)}`] : []), ...(v.sourceUrl ? [`URL:${v.sourceUrl}`] : []),
        `DESCRIPTION:${esc(`Listed hours for ${day}: ${h || 'not listed'}. Check the listing before you go.`)}`, 'END:VEVENT');
    }
  }
  return `${['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Family Weekend Planner//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].map(fold).join('\r\n')}\r\n`;
}

const iconBtn = `grid size-10 cursor-pointer place-items-center rounded-full border-2 border-line bg-surface text-[20px] hover:border-accent disabled:cursor-default disabled:opacity-40 ${ring}`;

export default function MyWeekend({ plan, weekend, dates, city, ops, onLeg }) {
  const [confirm, setConfirm] = useState(false);
  const count = plan.sat.length + plan.sun.length;
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buildIcs(plan, weekend)], { type: 'text/calendar' }));
    a.download = `family-weekend-${city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <section aria-labelledby="mw-title" className={`${card} mt-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mw-title" className="flex items-center gap-2 text-xl font-extrabold tracking-tight"><Ico as={EventNoteRounded} className="text-[26px] text-accent" /> My weekend</h2>
        <button type="button" className={btnGhost} onClick={() => (count ? setConfirm(true) : ops.suggest())} disabled={!ops.canSuggest}>
          <Ico as={AutoAwesomeRounded} className="text-[20px] text-accent" /> Suggest an itinerary
        </button>
      </div>
      <p className="text-[.9rem] text-muted">Built from the picks above. Times aren't suggested because we only show listed hours.</p>
      {confirm && (
        <div role="alert" className={`${note} flex-wrap items-center`}>
          <span className="flex-1">Replace your current plan?</span>
          <button type="button" className={btn} onClick={() => { ops.suggest(); setConfirm(false); }}>Replace</button>
          <button type="button" className={link} onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
      {count === 0 ? <p className="text-muted">Add places with the Add to Saturday/Sunday buttons to build your own plan.</p> : (
        <>
          {Object.keys(DAYS).map((k) => <Day key={k} k={k} date={dates[k]} stops={plan[k]} ops={ops} onLeg={onLeg} />)}
          <button type="button" className={`${btn} justify-self-start`} onClick={download}><Ico as={DownloadRounded} className="text-[20px]" /> Download calendar (.ics)</button>
        </>
      )}
    </section>
  );
}

function Day({ k, date, stops, ops, onLeg }) {
  const day = DAYS[k], other = k === 'sat' ? DAYS.sun : DAYS.sat;
  return (
    <div>
      <h3 className="font-extrabold">{day} <span className="font-normal text-muted">{date}</span></h3>
      {stops.length === 0 ? <p className="text-[.9rem] text-muted">Nothing planned yet.</p> : (
        <ol className="m-0 mt-2 grid list-none gap-2 p-0" aria-label={`${day} plan`}>
          {stops.map((v, i) => {
            const h = hoursFor(v, day);
            return (
              <li key={v.id} className="grid gap-2">
                {i > 0 && (
                  <button type="button" className={`${link} inline-flex items-center gap-1 justify-self-start text-[.9rem]`} onClick={() => onLeg(stops[i - 1], v)}>
                    <Ico as={RouteRounded} className="text-[18px]" /> Directions from {stops[i - 1].name}
                  </button>
                )}
                <div className="rounded-xl border border-line p-3">
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-extrabold text-accent-ink">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{v.name}</p>
                      {v.category?.label && <p className="text-[.9rem] text-muted">{v.category.label}</p>}
                      <p className="text-[.9rem]">{h ? `Listed hours: ${h}` : 'Hours not listed'}</p>
                    </div>
                  </div>
                  {h && /closed/i.test(h) && <p className={`${noteError} mt-2 text-[.9rem]`}><Ico as={WarningAmberRounded} className="mt-0.5 text-[18px]" /><span>Listed as closed on {day}</span></p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" className={iconBtn} aria-label={`Move ${v.name} up`} disabled={i === 0} onClick={() => ops.move(k, i, -1)}><Ico as={ArrowUpwardRounded} /></button>
                    <button type="button" className={iconBtn} aria-label={`Move ${v.name} down`} disabled={i === stops.length - 1} onClick={() => ops.move(k, i, 1)}><Ico as={ArrowDownwardRounded} /></button>
                    <button type="button" className={iconBtn} aria-label={`Move ${v.name} to ${other}`} onClick={() => ops.swap(k, i)}><Ico as={SwapHorizRounded} /></button>
                    <button type="button" className={iconBtn} aria-label={`Remove ${v.name}`} onClick={() => ops.remove(k, i)}><Ico as={DeleteOutlineRounded} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
