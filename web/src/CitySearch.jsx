import { useEffect, useId, useState } from 'react';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { Ico } from './ui.jsx';

// Label that tells same-named places apart: "Illinois, United States".
export const placeLabel = (c) => [c.region, c.country].filter(Boolean).join(', ');

export default function CitySearch({ onSelect, compact = true }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ok | empty | error
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  // Debounced search; abort the previous request so a slow old query can't replace newer results.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setStatus('idle'); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus('loading');
      try {
        const r = await fetch(`/api/cities?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setResults(d); setActive(d.length ? 0 : -1); setStatus(d.length ? 'ok' : 'empty'); setOpen(true);
      } catch (e) {
        if (e.name !== 'AbortError') { setStatus('error'); setOpen(true); }
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const choose = (c) => { onSelect(c); setQ(''); setResults([]); setOpen(false); setStatus('idle'); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % results.length); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  // Show the county/district only when name + region alone would be ambiguous.
  const isDup = (c) => results.filter((o) => o.name === c.name && o.region === c.region && o.country === c.country).length > 1;
  const showList = open && q.trim().length >= 2 && status !== 'loading' && status !== 'idle';

  return (
    <div className="relative min-w-0">
      <label htmlFor={`${listId}-input`} className="sr-only">Search location</label>
      <div className="flex items-center gap-2 rounded-full border-2 border-line bg-surface px-4 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/25">
        <Ico as={SearchRounded} className="text-[24px] text-accent" />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className={`min-w-0 flex-1 border-0 bg-transparent text-inherit outline-none placeholder:text-muted ${compact ? 'py-2.5 text-base' : 'py-2.5 text-base'}`}
          placeholder="Search location"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        {status === 'loading' && <span className="size-[18px] animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" aria-hidden="true" />}
      </div>
      <p className="sr-only" aria-live="polite">
        {status === 'loading' ? 'Searching…' : status === 'ok' ? `${results.length} cities found` : status === 'empty' ? 'No cities found' : ''}
      </p>
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-[5] m-0 max-h-[340px] list-none overflow-auto rounded-[14px] border border-line bg-surface p-1.5 shadow-card" aria-label="Matching cities">
          {status === 'ok' && results.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer flex-col rounded-[10px] px-3 py-2.5 ${i === active ? 'bg-accent-soft' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => i !== active && setActive(i)} // move, not enter: a list opening under a still cursor must not steal the highlight
              onClick={() => choose(c)}
            >
              <span className="font-semibold">{c.name}{isDup(c) && c.area ? <span className="font-normal text-muted"> ({c.area})</span> : null}</span>
              <span className="text-[.9rem] text-muted">{placeLabel(c)}</span>
            </li>
          ))}
          {status === 'empty' && <li className="cursor-default rounded-[10px] px-3 py-2.5 text-muted" role="option" aria-disabled="true" aria-selected="false">No cities match “{q.trim()}”. Check the spelling or try a nearby larger city.</li>}
          {status === 'error' && <li className="cursor-default rounded-[10px] px-3 py-2.5 text-error-ink" role="option" aria-disabled="true" aria-selected="false">City search is unavailable right now. Please try again in a moment.</li>}
        </ul>
      )}
    </div>
  );
}
