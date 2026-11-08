import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Marker looks come from Tailwind classes inside divIcon HTML (static strings only; names go in popups via textContent).
const pin = (html, size = 36) => L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
const ICONS = {
  centre: pin('<div class="size-5 rounded-full border-4 border-ink bg-surface shadow-card"></div>', 20),
  me: pin('<div class="grid h-7 place-items-center rounded-full border-2 border-surface bg-error-ink px-2 text-xs font-extrabold text-page shadow-card">You</div>', 40),
};
// marker is "1".."9" or "D" (never user text); secondary = outlined, smaller.
const markerIcon = (marker, secondary) => {
  const shape = marker === 'D' ? 'rounded-xl' : 'rounded-full';
  const look = secondary ? 'size-7 border-accent bg-surface text-accent text-sm'
    : marker === 'D' ? 'size-9 border-surface bg-ink text-page' : 'size-9 border-surface bg-accent text-accent-ink';
  return pin(`<div class="grid place-items-center border-2 font-extrabold shadow-card ${shape} ${look}">${marker}</div>`, secondary ? 28 : 36);
};

const popup = (title, sub, photo) => {
  const div = document.createElement('div');
  if (typeof photo === 'string' && photo.startsWith('/api/photo?')) {
    const img = document.createElement('img');
    img.src = photo; img.alt = ''; img.loading = 'lazy';
    img.className = 'mb-1.5 aspect-video w-44 rounded-lg bg-surface-2 object-cover';
    img.onerror = () => img.remove();
    div.append(img);
  }
  const b = document.createElement('strong'); b.textContent = title; div.append(b);
  if (sub) { const s = document.createElement('div'); s.textContent = sub; div.append(s); }
  return div;
};

// points: [{ id, marker, secondary, lat, lon, name, label }]; route: [[lat, lon], ...] or null; focus: { id } to open a popup.
export default function MapView({ city, points, me, route, focus, className = '' }) {
  const el = useRef(null), map = useRef(null), group = useRef(null), markers = useRef({}), fit = useRef(null);

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false, worldCopyJump: true }).setView([20, 0], 2);
    // Desktop: bottom-left (the panel covers the right). Mobile: top-right (the route card covers the bottom).
    L.control.zoom({ position: window.innerWidth >= 768 ? 'bottomleft' : 'topright' }).addTo(m);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    group.current = L.layerGroup().addTo(m);
    map.current = m;
    // Mobile keeps the map in a hidden tab (display:none). When it becomes visible Leaflet must re-measure, then refit.
    let wasHidden = el.current.offsetWidth === 0;
    const ro = new ResizeObserver(() => {
      const hidden = el.current.offsetWidth === 0;
      m.invalidateSize();
      if (wasHidden && !hidden) fit.current?.();
      wasHidden = hidden;
    });
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); };
  }, []);

  useEffect(() => {
    const m = map.current, g = group.current;
    g.clearLayers(); markers.current = {};
    const all = [];
    const add = (id, lat, lon, icon, title, sub, photo) => {
      markers.current[id] = L.marker([lat, lon], { icon, title, keyboard: true }).bindPopup(popup(title, sub, photo)).addTo(g);
      all.push([lat, lon]);
    };
    if (city) add('centre', city.lat, city.lon, ICONS.centre, `Centre of ${city.name}`, 'Starting point for route estimates');
    points.forEach((p) => p.lat != null && add(p.id, p.lat, p.lon, markerIcon(p.marker, p.secondary), p.name, p.label, p.photo));
    if (me) add('me', me.lat, me.lon, ICONS.me, 'You are here', 'From your shared location');
    const line = route?.length ? L.polyline(route, { color: '#0f766e', weight: 5, opacity: 0.85 }).addTo(g) : null;
    fit.current = () => {
      if (el.current.offsetWidth === 0) return; // hidden tab: refit happens when it becomes visible
      // Keep fitted content clear of the floating search bar and recommendations panel on desktop.
      const desk = window.innerWidth >= 768;
      const pad = { paddingTopLeft: [40, desk ? 100 : 40], paddingBottomRight: [desk ? Math.min(470, window.innerWidth * 0.42 + 30) : 40, desk ? 40 : 110], maxZoom: 15 };
      if (line) m.fitBounds(line.getBounds(), pad);
      else if (all.length > 1) m.fitBounds(all, pad);
      else if (all.length === 1) m.setView(all[0], 11);
      else m.setView([20, 0], 2);
    };
    fit.current();
  }, [city, points, me, route]);

  useEffect(() => { if (focus) markers.current[focus.id]?.openPopup(); }, [focus]);

  return <div ref={el} role="region" aria-label="Map of your weekend plan" className={`isolate z-0 bg-surface-2 ${className}`} />;
}
