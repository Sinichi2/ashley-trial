# Family Weekend Planner

**Live:** https://45-79-202-16.sslip.io/
**Source:** https://github.com/Sinichi2/ashley-trial (branch `main`)

Pick a city anywhere in the world and get its actual upcoming weekend: the forecast for both days, sourced activities for kids aged 4-8, and verified Italian dinner ideas. Every venue shows its source and when the data was retrieved.

## Quick start

```bash
# Local
node server/check.js                    # offline self-check (Node 18+, no network)
node server/server.js                   # API on 127.0.0.1:3000 (no key needed: keyless fallbacks)
cd web && npm ci && npm run dev         # UI with /api proxied to :3000

# On the server (as root)
systemctl restart family-planner        # restart the app
journalctl -u family-planner -f         # follow the app logs
systemctl status family-planner         # status
```

## Prerequisites

Ubuntu 24.04.4 LTS · Node v18.19.1 (from apt) · nginx 1.24.0 · certbot with `python3-certbot-nginx`.

```bash
apt-get update && apt-get install -y nginx nodejs npm certbot python3-certbot-nginx
useradd --system --create-home --home-dir /opt/planner --shell /usr/sbin/nologin planner
chmod o+x /opt/planner                  # let Nginx traverse to the static files
```

## Environment variables

| Variable | Required | Where |
|---|---|---|
| `GOOGLE_API_KEY` | Optional. Without it the app uses only the keyless providers. | `/etc/family-planner.env` (root, mode 600). The template is `.env.example`. |
| `PORT` | No (default 3000) | Set in the unit file |

Write the key from a root shell **on the server** (`ssh` in first). The prompt doesn't echo, so the key never appears in shell history or the repo. Don't wrap this in a one-line `ssh '...'` from Windows PowerShell: PowerShell 5.1 strips the inner quotes and `read` fails.

```bash
read -rsp "Google API key: " K; echo; umask 077
printf "GOOGLE_API_KEY=%s\n" "$K" > /etc/family-planner.env; chmod 600 /etc/family-planner.env
systemctl restart family-planner
```

The key needs **Places API (New)** and **Weather API** enabled. Restrict it to the server IP.

## Build and deploy

```bash
cd web && npm ci && npm run build       # produces web/dist (static)
```

The root `package-lock.json` is there for completeness: the API has **zero runtime dependencies**. `web/package-lock.json` pins the UI toolchain (React 18, Vite 5, Tailwind v4).

Copy the files to the server, owned by root so the app user can't modify its own code:

These are the commands actually used, run from the repo root on the dev machine (`ashlex` is an SSH config alias for `root@45.79.202.16` with a dedicated key):

```bash
ssh ashlex 'mkdir -p /opt/planner/app/server /opt/planner/app/web/dist'
scp package.json ashlex:/opt/planner/app/
scp server/*.js ashlex:/opt/planner/app/server/
# swap the static build in atomically, so visitors never see a half-copied dist
ssh ashlex 'rm -rf /opt/planner/app/web/dist.new && mkdir -p /opt/planner/app/web/dist.new'
scp -r web/dist/* ashlex:/opt/planner/app/web/dist.new/
ssh ashlex 'cd /opt/planner/app/web && rm -rf dist && mv dist.new dist \
  && chown -R root:root /opt/planner/app && chmod -R a+rX /opt/planner/app \
  && systemctl restart family-planner'
```

**Start under systemd.** The unit file is `deploy/family-planner.service`, copied from the live server:

```bash
cp deploy/family-planner.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now family-planner
```

**Nginx and TLS.** The site config is `deploy/nginx-site.conf`, copied from the live server; certbot manages its TLS lines:

```bash
cp deploy/nginx-site.conf /etc/nginx/sites-available/default
ufw allow OpenSSH && ufw allow "Nginx Full" && ufw --force enable
certbot --nginx -d 45-79-202-16.sslip.io --non-interactive --agree-tos --register-unsafely-without-email --redirect
nginx -t && systemctl reload nginx
```

`sslip.io` resolves `45-79-202-16.sslip.io` to `45.79.202.16`, so there was no domain to buy. HTTPS also enables "Use my location", since browsers only allow geolocation over HTTPS.

## Restart and logs

| Task | Command |
|---|---|
| Start / stop / restart | `systemctl start\|stop\|restart family-planner` |
| Status | `systemctl status family-planner` |
| App logs (live) | `journalctl -u family-planner -f` |
| Nginx logs | `tail -f /var/log/nginx/access.log /var/log/nginx/error.log` |
| Reload Nginx | `nginx -t && systemctl reload nginx` |
| Certificate renewal | automatic (`certbot.timer`). Dry run: `certbot renew --dry-run` |
| Redeploy | copy the files, then `systemctl restart family-planner` |

## Persistence and ports

- **Survives logout and reboot:** systemd runs the app, not the SSH session. `enable` starts it at boot and `Restart=always` brings it back after a crash. This was verified after a restart followed by SSH logout (see VERIFICATION.md).
- **Least privilege:** the app runs as `planner`, a system user with no login shell. It runs with `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome` and `PrivateTmp`.
- **Ports (ufw):** 22 (SSH), 80 (only redirects to HTTPS with a 301), 443 (HTTPS). The API listens on **127.0.0.1:3000** only.
- **SSH:** the existing access and credentials were left as they were. An extra key was added for deployment.

## Features

- **Layout (from the candidate's low-fi sketch):**
  - **Desktop:** a full-screen map. A floating top bar holds the menu, "Search location" and a filter button, which opens the filter chips. A **Recommendations** panel on the right holds the results.
  - **Mobile:** search and filter at the top, recommendation cards, and a bottom navigation bar with three tabs: Plan, Map and Info.
- **Recommendations near you:** when a visitor shares their location ("Use my location") and is within 50 km of the chosen city, distances and ranking are measured from them, and cards say "x km from you". Otherwise distances are measured from the city centre. `getPlan` accepts an optional `from=LAT,LON` for this.
- **Personalization:**
  - **On the homepage:** the preference chips and the Indoors only switch appear inline. The same controls are behind the filter button once results load.
  - **In the results:** a line says "Personalized for: …" with an **Edit** link.
  - **How we pick:** a plain-language summary of the ranking rules in `server/data.js`: `eligibleActivity`, then `score`, then `pickActivities` and `extraActivities`.
- **Caching:** `index.html` is sent with `Cache-Control: no-cache`, so a deploy shows up on the next load. Hashed build assets are cached for a year.
- **My weekend (itinerary builder):**
  - **Adding stops:** every venue card has **Add to Saturday / Add to Sunday** buttons.
  - **Editing:** stops can be reordered, moved to the other day or removed. Each stop shows that day's listed hours, with a warning when the listing says it's closed.
  - **Suggest an itinerary:** fills the plan from the verified picks only: Saturday's activity then dinner, and Sunday's activity. No times are suggested, because only listed hours are known.
  - **Directions between stops:** each leg uses OSRM.
  - **Calendar:** "Download calendar (.ics)" exports all-day events.
  - **Saving:** the plan is kept per city in `localStorage`, with no account needed.
- **Venue photos:** the first Google listing photo appears on each card and in its map popup, credited "Photo: {author} via Google" as Google requires. OpenStreetMap venues, and photos that fail to load, fall back to the category icon.
- **Onboarding:** a 3-step walkthrough on the first visit. It can be skipped, closes with Escape, and can be reopened from the menu or the Info tab. It remembers you've seen it in `localStorage`, and works without storage too.
- **Directions:** each venue card has a **Directions** button that draws the driving route on the map, with the time and distance. On mobile it switches to the Map tab. "Open in Google Maps" is offered for walking and transit.
- **City search:** shows city, region and country, so same-named places can be told apart (a "Paris, Texas" qualifier also works). There's an optional "Use my location" that asks before using it and needs your confirmation.
- **Filter chips:** Animals, Science, Nature, Arts, History, and Action & Play (internal key `handson`), plus an **Indoors only** hard filter (`indoor=1`). Indoors only keeps a venue only when its source type proves it's indoors; venues whose type is unknown are excluded.
- **Things to do:** two picks, one for each weekend day.
  - **More options:** up to 2 more that match the filters.
  - **Something different:** one pick deliberately outside the filters, labelled e.g. "Outside your filters (History, Indoors only)".
- **Italian dinner ideas:** the main pick plus up to 2 verified alternatives.
- **Forecast:** both dates in the city's own calendar and timezone, with high and low and their units, and precipitation.
- **Map and travel time:** OpenStreetMap tiles via Leaflet. Driving time comes from OSRM.
  - **Starting point:** your shared location if you are within 50 km of the city; otherwise the city centre. The card always says which one it used.
- **Plan your visit:** price, opening hours for the planned day, accessibility, family features (good for children, kids menu, restroom), parking, and rating.
  - These appear only when the provider supplies them. A missing price reads "Price not listed".

## Code layout

| Path | Role |
|---|---|
| `server/data.js` | Provider calls, normalization and planning logic. `weekendFor`, `score`, `pickActivities` and `extraActivities` are pure functions tested offline. The comment on `weekendFor` explains why a Sunday plans for the following weekend. |
| `server/server.js` | The HTTP boundary: routing, input validation, JSON errors. `/api/health`, `/api/cities`, `/api/plan`, `/api/reverse`, `/api/route`. |
| `server/check.js` | Offline self-check: fixed clock, stubbed `fetch`, test data inside the file |
| `web/` | The UI (React 18, Vite 5, Tailwind v4) |
| `deploy/` | The live systemd unit and the Nginx site config |

## Providers

| Need | Primary | Fallback |
|---|---|---|
| City search | Open-Meteo Geocoding (keyless) | none |
| Forecast | Google Weather API | Open-Meteo |
| Activities and dining | Google Places API (New) Nearby Search | Nominatim (OpenStreetMap), 1 request/s queue |
| Travel time | OSRM public router (`router.project-osrm.org`), driving only | none |
| Map tiles | OpenStreetMap via Leaflet | none |
| Venue photos | Google Places Photos (New), served by the server at `/api/photo` and cached for 24 hours | category icon (OpenStreetMap venues have no photos) |

**Places fields:** the field mask also requests website, price level and range, opening hours for each weekday, accessibility, goodForChildren, menuForChildren, restroom, parking, rating and rating count. The candidate asked for these to support pricing and planning information. They move every request into Google's **Enterprise + Atmosphere** price tier. Results are cached for 1 hour per city to limit the cost.

**To go back to the cheaper Pro tier:**
1. In `googleVenues` in `server/data.js`, cut the `X-Goog-FieldMask` value after `places.googleMapsUri`.
2. Redeploy.

The cost is that the "Plan your visit" facts disappear from Google results.

**Changed from the brief:** Google access was pending at the start, so the app was built on keyless sources first. The **Overpass API** was the first venue source, but from the Linode even a trivial query took about 22s and real queries timed out at 45-90s. It was replaced with **Nominatim** (about 1s per call, same OpenStreetMap data), which became the fallback once a valid Google key was installed (around 19:00).

**Attribution:** the UI credits every source it used (Google Maps, © OpenStreetMap contributors, Open-Meteo, OSRM). All provider calls and keys stay on the server; no key reaches the browser.

## Technical decisions

- **`node:http` instead of Express:** Nginx serves the static files, so the API is a few GET routes and needs no runtime dependencies.
- **Independent sections:** weather, activities and dining are computed separately with `Promise.allSettled`. Each upstream call has a 15s limit.
- **Section status:** each section returns `{status: ok|partial|unverified|unavailable, reasonCode, sources, message}`, so one failing provider never blanks the page. The logs record only `provider=<host> category=<reasonCode>`.
- **Validation:**
  - A venue needs a name, valid coordinates and an https listing URL.
  - A forecast day needs a finite high and low and a known unit.
  - A precipitation value of `0` stays distinct from `null` (no data).
- **Eligibility, then ranking:** a venue must show it suits ages 4-8 (by its category type, or the provider's `goodForChildren`). Eligible venues are then ranked on:
  - suitability for the age group,
  - interest match (+4 / −2),
  - weather (bad day: indoor +3, outdoor −3; good day: outdoor +2),
  - distance (−km / 5).
- **Dining:** a restaurant counts only if the provider says it's Italian. That means Google's `italian_restaurant` type, or OSM `cuisine=italian` or the whole word "Italian" in the name. Otherwise the section says "We couldn't verify a suitable Italian restaurant in this city."
- **Facts vs reasoning:** prices, hours, accessibility and parking come only from provider fields and are never estimated. The "Why this fits" text is generated reasoning, shown separately.
- **Dates:** "today" is computed in the city's IANA timezone. Forecast days are matched by `YYYY-MM-DD`, never by position.
- **Stale requests:** an `AbortController` plus a request id mean only the latest search or plan is ever shown.
- **Cache:** in-process with TTLs (city search 24h, weather 30m, venues 1h). Cached data keeps its original retrieval time.

## Verification and pre-submission review

```bash
node server/check.js          
cd web && npm run build       
# secret scan of the source tree (expect no output)
grep -rlE "AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH) PRIVATE KEY" --exclude-dir=node_modules --exclude-dir=dist --exclude=".env.*" .
```

Live and visual checks were run against the deployed URL. Every result, with its method, input, expected outcome, observed outcome and status, is in [VERIFICATION.md](VERIFICATION.md), together with a safe way to demonstrate a provider failure live.

## Known limitations

- **Travel times:** OSRM's public demo server has no SLA and gives driving times only.
- **Real-device geolocation:** not tested yet; Playwright used a simulated position.
- **Reboot:** not tested yet. A service restart followed by SSH logout was verified.
- **Cost:** the extra Places fields cost more. The 1-hour cache limits that but doesn't remove it.
- **Slow fallback:** a first plan through the Nominatim fallback takes about 11-18s because of its rate limit.
- **Cache:** in-process, so it's lost on restart and each process has its own copy.
  - That's fine for a single instance. A shared store such as Redis would only be needed with more than one instance.
- **Hours and prices:** listed hours may be out of date. Attractions often show "Price not listed".

## Recommended improvements

These came out of a code-quality review at the end of the timed session. They were left undone because the deadline was close and they were too large to change safely.

1. **Split `server/data.js` (about 560 lines) by responsibility.**
   - **Providers file:** calls to Google, Open-Meteo, Nominatim and OSRM, plus normalization of their responses.
   - **Planning file:** `weekendFor`, eligibility, `score`, `pickActivities`, `extraActivities`, `pickRestaurant`.

   Today these are two clear halves of one file. Splitting them makes the separation of provider calls from planning logic explicit, and means the planning tests no longer import network code. This is the highest-value item.
2. **Split `web/src/App.jsx` (about 700 lines)** into focused components (venue card, forecast, filters, menu, route summary), keeping `App` for state and data fetching only.
3. **Remove the duplicated fact fields.**
   - **API:** it still returns the older OpenStreetMap-shaped fields (`fee`, `wheelchair`, `kidFriendlyTags`) alongside their replacements (`price`, `accessibility`, `familyFeatures`). The UI has fallbacks for both, so the old fields can go.
   - **UI:** it also still handles an `error` status that the API no longer sends. That branch can go too.
4. **Open the filters through shared state, not the DOM.** The "Edit" link next to "Personalized for" currently opens the filters by clicking the filter button via `document.getElementById`. Lifting the popover's open state into `App` would avoid reaching into the DOM.
5. **Add a `.gitattributes` with `* text=auto eol=lf`.** Then the `deploy/` configs, which are used on Linux, always keep Unix line endings, even when the repo is checked out on Windows.
6. **Recommended for Ashlex, not applied:** SSH hardening (key-only login, no root password login). It was deliberately not applied, because Ashlex's existing SSH access had to stay unchanged.

## Security

- **Kept out of the source package:** `node_modules`, `web/dist`, `.env` and `.env.*`, via `.gitignore`. The developer machine has a local `.env.local` holding a key; it is excluded and never committed.
- **Secret scan:** run over the repo for key, password and email patterns before submission.
- **Where the key lives:** only in `/etc/family-planner.env` on the server.

### Platform hardening (security direction set by the candidate)

| Layer | What | Files |
|---|---|---|
| Honeypot | Scanner-only paths (`/.env`, `/.git`, `/wp-login.php`, `/wp-admin`, `/phpmyadmin`, `/xmlrpc.php`, `/cgi-bin`, `/actuator` and others) return 404. They are logged to `/var/log/nginx/honeypot.log`, and **fail2ban bans the IP from ports 80 and 443 for 24h on the first hit**. | `deploy/nginx-server-security.conf`, `deploy/fail2ban/` |
| Rate limits | `/api/plan`, which calls paid Google APIs, allows 20 requests per minute per IP (burst 10). The rest of `/api/*` allows 5 per second (burst 20). Excess requests get 429. More than 20 limit hits in 10 minutes means a 1h ban (`nginx-limit-req` jail). `/api` accepts GET and HEAD only. | `deploy/nginx-http-security.conf`, `deploy/nginx-site.conf` |
| Headers | A strict CSP: scripts from this site only, images from this site plus OpenStreetMap tiles, no framing. Also HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, and a `Permissions-Policy` that allows geolocation for this site only. `server_tokens off` hides the Nginx version. | `deploy/nginx-server-security.conf` |
| App | Inputs are validated at the API boundary. Errors are generic, with no provider text. Logs record only provider and category. The photo proxy accepts only Google photo resource names, so it can't fetch arbitrary URLs, and the key is never sent to the image host (`skipHttpRedirect`). | `server/` |
| Process | The app runs as user `planner` (no shell) under systemd with `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome` and `PrivateTmp`. The API binds to 127.0.0.1 only. | `deploy/family-planner.service` |
| OS | ufw allows only 22, 80 and 443. `unattended-upgrades` is enabled. | n/a |


**Install:**
```bash
apt-get install -y fail2ban
cp deploy/nginx-http-security.conf /etc/nginx/conf.d/family-planner-security.conf
cp deploy/nginx-server-security.conf /etc/nginx/snippets/family-planner-security.conf
cp deploy/fail2ban/fwp-honeypot.conf /etc/fail2ban/filter.d/
cp deploy/fail2ban/family-planner.local /etc/fail2ban/jail.d/
touch /var/log/nginx/honeypot.log
nginx -t && systemctl reload nginx && systemctl restart fail2ban
```

**Operate:**
```bash
fail2ban-client status fwp-honeypot
fail2ban-client set fwp-honeypot unbanip <IP>
tail -f /var/log/nginx/honeypot.log
```
