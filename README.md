# Wonrich Dairy - frontend

React client for the Wonrich Dairy Quality Monitoring & Traceability System. The screens follow
the Figma designs, which are drawn at 390px: the officer works on a phone at the gate, so the
shell is mobile-first and simply centres itself on a wider screen.

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
| `VITE_INTAKE_API_URL` | `http://localhost:5237` | MCC & Intake Service |
| `VITE_AUTH_API_URL` | `http://localhost:5000` | Auth service issuing the bearer token |

## Screens

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
