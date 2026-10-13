# Wonrich Dairy - frontend

React client for the Wonrich Dairy Quality Monitoring & Traceability System. The screens follow
the Figma designs, which are drawn at 390px: the officer works on a phone at the gate, so the
styles are mobile-first. Wider screens get more room: from 768px forms stay at a readable width
and list and dashboard screens lay their cards out in a grid (routes flagged `wide` in
`App.tsx`), and from 1024px the bottom tab bar becomes a rail down the left.

## Tech stack
- React 19 + TypeScript, built with Vite
- Vitest + Testing Library for unit and screen tests
- No UI framework: the design tokens in `src/styles/tokens.css` carry the visual language

## Prerequisites
- Node 20 or newer
- The [MCC & Intake Service](https://github.com/wonrich-dairy/mcc-intake-service) and the auth
  service running, or reachable in staging

## Getting started
```powershell
npm install
copy .env.example .env.local   # then point the two URLs at your services
npm run dev
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and produce a production build |
| `npm test` | Run the suite once |
| `npm run test:watch` | Re-run on change |
| `npm run lint` | oxlint |

## Configuration
| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_INTAKE_API_URL` | `https://wonrich-mcc-app-abhgfsaxc6a3eqfa.malaysiawest-01.azurewebsites.net` | MCC & Intake Service |
| `VITE_TRACEABILITY_API_URL` | `http://localhost:5300` | Traceability & QC Dashboard Service |
| `VITE_AUTH_API_URL` | `https://wonrich-auth-app-f4dndrgcgzgjb5h4.malaysiawest-01.azurewebsites.net` | Auth service issuing the bearer token |

## Screens

Routing is a small path router over the History API in `src/app/` — the client carries no routing
dependency, because the npm registry is not reachable from this build environment. The bottom tab
bar is Home / Consignments / Tanks / Settings, as the frames are drawn.

| Route | Screen | Frame |
| --- | --- | --- |
| `/` | Dashboard: the shift, today's four figures, quick actions | Dashboard |
| `/consignments` | Register a society consignment (SCRUM-53) | Register Consignment |
| `/consignments/quality-test` | The gate quality panel (SCRUM-54) | Quality Test Panel |
| `/tanks` | Live tank status | Chilling Tanks |
| `/tanks/:code` | One tank: fill, pour action, manifest | Tank Details and Temperature |
| `/tanks/:code/pour` | Pour accepted consignments in (SCRUM-52, SCRUM-10) | Pour Consignment |
| `/dispatch` | Bowser dispatch note (SCRUM-8) | Dispatch Note |
| `/trace` | Trace a batch back to its societies (SCRUM-12) | Trace Batch |
| `/settings` | Manage societies and tanks (SCRUM-51) | Settings |
| `/settings/societies/new`, `/settings/societies/:id` | Add and edit a society | Add / Edit Society |
| `/settings/tanks/new`, `/settings/tanks/:code` | Add and edit a tank | Add tank / Edit tank |
| `/profile` | Who is signed in, the shift, sign out | User Profile |
| `/queue` | What is held on the device (SCRUM-10) | *(no frame)* |
| `/qco/batches` | Find a batch by batch ID, dispatch reference or WR- batch reference (SCRUM-137); filter batches and export them as CSV (SCRUM-139) | *(no frame)* |
| `/qco/batches/:batchId` | The batch timeline: checkpoints in stage order, deviations marked, gaps shown as missing (FR8) | *(no frame)* |
| `/qco/batches/:batchId/trace` | Backward trace: first deviation highlighted, tanks and societies ranked by quantity (FR7) | *(no frame)* |
| `/qco/audit` | Consolidated audit trail: who recorded or did what, and when, across every facility (SCRUM-138) | *(no frame)* |
| `/qco/audit/coverage` | Which actions the audit trail covers and which it does not, with the reason (SCRUM-138) | *(no frame)* |

### Batch search, timeline and backward trace (SCRUM-137)
`src/features/qco/batches` - the QCO's Batches tab, reading the Traceability Service's
`GET /api/batches/{batchId}` and `GET /api/batches?dispatchRef=…|batchReference=…`. Only the
Quality Control Officer and the System Administrator can open it, as the service enforces.

A term starting `WR-` is looked up as factory intake's batch reference, a batch code such as
`262-FM-B` as a batch ID, and anything else as the MCC dispatch reference. A single match opens
the batch; a dispatch split across several batches lists them. No match is a message, not an error.

A checkpoint with no data is never left blank: it is marked missing with the reason the service
gives (not reached yet, the upstream lookup still retrying or unavailable, or an event that never
arrived), and the backward trace says which checkpoints a "no deviation" result cannot speak for.
Deviations use the shared `DeviationBadge`, which the Processing stage list uses as well.

### Batch filters and CSV export (SCRUM-139)
Below the lookup, **Filter batches** reads the Traceability Service's `GET /api/batches/search`
and `GET /api/batches/export`. The filters are status, product line, from and to (factory days of
the batch's first event), society (code or name), tank, user, reason and facility. All are
optional, and the ones given must all match. They live in the URL with the page, e.g.
`/qco/batches?status=Failed&productLine=FM&page=2`, so a refresh, a shared link or the way back
from a batch shows the same page. `?page=1` alone means every batch. Applying filters replaces a
lookup term in the URL and the other way round, so only one set of results shows at a time.

Results come 50 to a page, newest first, with the total and Previous / Next. A filter that matches
nothing shows the service's message as information, not an error, and offers no export.
**Export to CSV** asks for every match, not just the page. It saves the file under the name the
service gives it (filters and export date) and says how many batches it held. The service fills
not-applicable and unknown cells with explicit markers and audits each export. A refused or failed
export is shown as an error and saves nothing.

### Audit trail and coverage (SCRUM-138)
`src/features/qco/audit` - the QCO's Audit tab, reading the Traceability Service's
`GET /api/audit` and `GET /api/audit/coverage`. Only the Quality Control Officer and the System
Administrator can open it (`viewAuditTrail`, the service's `AuditTrail` policy). It only reads:
the service has no endpoint to change or remove an entry, and nothing here offers to.

The trail opens on its first page of every entry, newest first, 50 to a page. Each row has the
time (Colombo), user, action, checkpoint, batch (opening its timeline) and source: a consumed
event, the batch's upstream snapshot, or Traceability itself (a batch opened, a search exported).
No cell is blank: a user the source did not record reads "Not recorded", an action with no
checkpoint reads "None", and an export reads "Several batches". The filters are user, action
(suggested from the coverage list), from and to (factory days) and batch ID, kept in the URL with
the page, e.g. `/qco/audit?user=proc.tech-1&from=2026-09-19&page=2`.

**What the audit trail covers** lists each covered action with its checkpoint, source and what
it records, then what is not covered and why. It is the service's own list, so the page never
claims more than the trail shows. Each covered action opens the trail filtered to it.

### Where the design asks for more than the service offers

These are laid out as drawn but do not collect input the service cannot keep. Collecting a reading
or a signature this client would then drop is worse than a control that says why it is not there.

| Frame | What is missing |
| --- | --- |
| Tank temperature, "Log Temperature", "Recent Readings" | No endpoint reads or writes a tank temperature, and `TankView` has no thermal field. The tank screens lead with the fill the service does publish, and the manifest stands in for the readings table. |
| Add / Edit / Delete Tank | `TanksController` has no create, update or delete, and no tank status field, so "Under Maintenance" has nowhere to live. |
| Dispatch note: P.O. number, time in, F.T/R.T/V.B seals, three signatures | `RecordDispatchNoteRequest` carries the bowser, driver, dispatch time, source tanks and the panel, and nothing else. |
| Settings: App Preferences, Notification Settings, Help & Support | Nothing exists behind these rows in the service or the backlog. |
| Dashboard tiles, profile shift and intake count | No summary or shift endpoint. Both are counted from the day's consignments, which is real data rather than a placeholder. |

### Consignment registration (SCRUM-53)
`src/features/consignments` - an intake officer picks the supplying society, enters the can sheet,
and registers the delivery against `POST /api/consignments`.

**Cans are recorded in kilograms.** The Figma frame labels that column LITERS, but the service
takes `quantityKg` per can and derives litres itself from the centre's configured milk density -
a figure no endpoint publishes, so the screen cannot convert faithfully. Litres come back on the
response and are shown on the confirmation. Worth reconciling with the design.

Validation mirrors what the service enforces, so the officer is told at the gate rather than after
a round trip: a society must be chosen, at least one can recorded, each label must carry that
society's tag and a can number in 1-999, no can twice, and each weight above zero and no more than
1000 kg. The service remains the authority - `src/features/consignments/canSheet.ts` only saves a
round trip.

The can sheet appears once a society is chosen. It used to render a blank row and an "Add another
can" button straight away, both inert because a can label cannot be checked without the society's
tag (SCRUM-94).

Once a consignment is registered the screen confirms it with the allocated reference and clears
the sheet, so the next delivery starts clean and the previous one cannot be submitted twice.

### Sign-in
Every intake route is guarded, so the officer signs in first (SCRUM-34). The token is held in
`sessionStorage` rather than `localStorage`: the gate device is shared, and closing the tab should
end the shift's session rather than leave it signed in for whoever picks it up next.

## Testing
The suite runs on jsdom. Vitest is pinned to the `threads` pool in `vite.config.ts` because the
default `forks` pool cannot start a worker on the current Windows setup.

## Branching strategy
- `main`: protected, production-ready
- `develop`: protected integration branch
- `feature/SCRUM-<key>-<description>`: work branches, merged into `develop` via reviewed PR
