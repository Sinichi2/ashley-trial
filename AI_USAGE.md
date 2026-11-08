# AI usage notes

## Tools

| Tool | Used for |
|---|---|
| Claude Code CLI (Claude Opus 5.5) | Pair programming: the data layer, deployment (systemd, Nginx, TLS, ufw), debugging, verification |
| Claude Code background sub-agents | Parallel work in separate files: backend (Google providers with fallbacks, replacing Overpass with Nominatim, section statuses, filters, `/api/reverse`, `/api/route`), frontend (React/Vite UI, Tailwind, redesign, map), docs (these files) |
| Playwright-core driving Microsoft Edge | Browser checks at 390x844 and 1280x900. Installed in a scratch folder only, not added to the project. |
| Claude Code (documentation) | The candidate used AI to create the Markdown files (`README.md`, `VERIFICATION.md`, `AI_USAGE.md`). They were drafted from results observed in the session; the candidate directed their structure and reviewed them. |
| `ponytail` skill | Kept the code minimal: zero runtime dependencies, no framework |

## How AI output was checked

- **Manual code review by the candidate:** the candidate read and checked the AI-written code by hand, in addition to the automated and live checks below.
- **Manual testing by the candidate:** the candidate tried the live site in the browser and reported layout and behaviour problems, which were then fixed. Examples: the filter popover covering the Recommendations panel, and a stale page making the mobile map look broken.
- **`node server/check.js`:** fixed clock, stubbed `fetch`, test data inside the file. It covers dates, ranking, filters, eligibility, timeouts, partial forecasts and cache timestamps. It was mutation-tested: making eligibility always true makes it fail.
- **curl from outside the server** against the public HTTPS URL. This included a check after a restart followed by SSH logout.
- **Timing probes on the server**, which is how the Overpass slowness was measured.
- **Server-side checks:** `journalctl`, `ss`, `ps` and the Nginx error log.
- **Playwright runs** of the live site, including mocked slow and failing responses.
- **Anything not verified** is marked Not run in VERIFICATION.md.

## Representative prompts
- **Planning:** "Start with gathering data across cities worldwide using Open-Meteo and OpenStreetMap Overpass. Include a graceful fallback. Use Tailwind instead of plain css. Do not use emojis, use icons. I'll send a lofi design that you should follow. " 
- **Coding:** "Add Google Places and Google Weather as the primary sources, with keyless fallbacks. Give each section its own status with a reason code. Never invent prices, hours or venues."
- **Troubleshooting:** "Overpass timed out for every city. Check whether it's the network or the service, and measure from the Linode." / "The page returns 500 behind Nginx. Find out why from the error log."
- **Testing:** "Write a check that fails if a generic museum gets through eligibility, then prove it by breaking the rule." / "Verify at 390 and 1280 wide and simulate a slow response for an old city."

## Problems found and fixed during the session

| Problem | How it was found | Fix |
|---|---|---|
| A remote heredoc expanded `${...}` in the remote shell | bash "bad substitution" | Write the script locally and copy it over with `scp` |
| ES module imports failed on Node 18 | `Named export not found ... CommonJS` | Copy `package.json` (`"type": "module"`) along with the code |
| Overpass was too slow (22s trivial, 45-90s real) | Timed with probes from the Linode | Replaced with Nominatim, then made the fallback once Google worked |
| Nginx returned 500 | Error log: `stat() Permission denied` | `/opt/planner` was 700 → `chmod o+x` |
| Drizzle at 19% counted as a wet day | Reviewing the probe output | The wet-day rule starts at rain codes |
| Google rejected the key | Logs showed the fallback reason; the stored value was 1 character (shape checked, not read) | Re-entered (39 characters); Google works as of 19:07 |
| `/ital/` matched "Hospital" and "Capital" | Code review | Whole-word "Italian" match |
| The pointer stole the city selection (London, Ohio) | Live Playwright run | Hover no longer selects when the list opens under a cursor that hasn't moved |

## Decisions made by the candidate

**Confirmed by the candidate:** the candidate led the platform's security and its code direction. The AI tools carried out the implementation within that direction, and their output was checked as described above.

Where that direction shows in this session:

**Deployment:** the candidate owned and directed the deployment to the assigned Linode:
- **Access:** set up SSH key access to the server.
- **Secrets:** installed the Google API key on the server personally, so it never passed through the AI tools.
- **HTTPS:** chose sslip.io with Let's Encrypt.
- **Approval:** approved each deployment step. The deployment commands (file copy over SSH, Nginx, systemd, certbot, ufw, fail2ban) were run through Claude Code in the candidate's session.
- **Testing:** tested the deployed site personally.

**Security direction:**
- Moved the work to platform security and asked for the honeypot and hardening layer: honeypot paths with fail2ban bans, rate limits on the paid API endpoint, and security headers.
- Kept the API keys and credentials out of the chat, the frontend and the repo, and installed the Google key on the server personally.
- Set the reliability rules: approved sources with provenance, validation, filtering on evidence before ranking, independent section failures, and no sample data.

**Code and product direction:**
- **Data first:** started with Open-Meteo and OpenStreetMap so the data layer could be built before Google access was approved.
- **HTTPS:** chose sslip.io with Let's Encrypt, which also made "Use my location" possible.
- **Styling:**
  - Tailwind instead of plain CSS.
  - Material UI icons.
  - The design-taste-frontend redesign: icons instead of emoji, no gradients, kept simple.
- **Layout:** drew two low-fi sketches that set the layout.
  - Desktop: a map-first view with a floating search bar and a Recommendations panel.
  - Mobile: a Plan / Map / Info tab bar.
- **Features:**
  - an onboarding flow
  - in-app directions
  - filters (Indoors only, History, Action & Play)
  - the "More options" and "Something different" suggestions
  - several Italian dinner ideas
  - pricing and planning facts
  - venue photos
- **Cost:** accepted the higher Google Places price tier so pricing and planning facts could be shown.
- **Handoff:** asked for every `ponytail` code comment to be removed, and set the structure of the handoff documents.

## Explain omissions

- **Prompts are paraphrased,** not quoted word for word. Some were long, and some contained session details such as the server credentials.
- **Secrets are removed.** No API key, password, SSH key or personal email appears in any document. The root password was shared in chat during setup; it was never used by the tools, and Ashlex should rotate it.
- **Full transcripts are not included,** including the sub-agents' transcripts. They are long, contain tool output from the server, and could carry secrets. This file summarises them.
- **Times written as "18:3x"** are approximate where the exact minute wasn't recorded.

## Security of the source package

- **Excluded via `.gitignore`:** `node_modules`, `web/dist`, `.env` and `.env.*`. The developer machine has a local `.env.local` holding a key; it is excluded and never committed.
- **Secret scan:** run for key, password and email patterns before submission.
