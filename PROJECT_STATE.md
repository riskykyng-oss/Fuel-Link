# FuelLink — Project State & Canonical Architecture

> Living document. Keep this in sync with the codebase. It doubles as the
> handoff prompt for a fresh session.

## Canonical architecture

```
                  FUEL LINK
                      │
                Firebase Backend
                      │
       ┌──────────────┼──────────────┐
       │              │              │
   Motorists       Garages        Drivers
       │              │              │
       └──────────────┼──────────────┘
                      │
                   Orders
```

- **Motorists** (clients) request a service. Home screen is a two-way choice:
  **Fuel** (nearest gas stations, live grades + prices) or **Assistance**
  (nearest garages/mechanics, services + ETA).
- **Garages** are the supply side (mechanics/gas stations). They receive
  incoming orders, dispatch drivers, manage stock/pricing and see earnings.
- **Drivers** (couriers/tankers) are dispatched to execute orders — pickup,
  en-route, handover with a 4-digit OTP, payout.
- **Orders** are the central entity linking all three actors.
- **Firebase** is the intended backend tier (Auth, database, storage,
  messaging). The current working backend is FastAPI + SQLite on `:8000`; the
  Firebase migration is pending (photo uploads already scaffolded).

## Demo logins (backend)
- Motorist: `0771234567` / `password123` (phone pre-verified in seed)
- Supplier/Garage: `0712345678` / `password123`
- Mechanic supplier seeded idempotently every boot: `0786669991` ("Harare Mobile
  Mechanics", online + verified, services mechanic/lockout/tyre_change/jump_start).

## Stack & repo layout
- Root: `C:\Users\Admin\Desktop\fuellink`
- `frontend/`: React 19.1.1 + Vite 7.1.7 + TypeScript 5.9.2 strict
  (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` — use
  `import type` for types), react-router-dom, Leaflet + `@types/leaflet`,
  Firebase (placeholder config), Tailwind v3.4.19 + postcss + autoprefixer.
- `backend/`: FastAPI + SQLite (`fuellink.db`), `smoke_test.py` (97 checks;
  run with `FUELLINK_DATABASE_URL=sqlite:///./smoke_test.db`). Live at
  `http://localhost:8000`, health at `/api/health`.
- Dev server: `:5173`, fresh `npm run dev` (restart after vite.config changes).
  Multi-entry build: `index.html` (app) + `design.html` (component gallery).
  Vite proxies `/api` + `/ws` to `:8000`.

## Motorist flow (implemented) — OPEN → ACCOUNT → REQUEST
Every FR below is mapped to a passing `smoke_test.py` check (97 total).
- **OPEN** (no account): `POST /api/coverage` (`lat`/`lng`) returns
  `covered`, `est_response_min`, `stations`. Frontend `WelcomeScreen` (route
  `/`, pre-auth) does a GPS coverage check with no account (FR-1/FR-25).
- **ACCOUNT**:
  - `POST /api/auth/register/customer` — vehicle fields now OPTIONAL (FR-2);
    duplicate/verified number → 409 (FR-6). Frontend signup asks name/phone/
    password only, then routes to verification.
  - `POST /api/auth/code/request` — 6-digit code, 5-min TTL, resend throttle
    60s, per-phone (10/15min) + per-IP (20/15min) sliding windows (FR-11).
    `sms_mode=mock` returns `dev_code` so the flow runs without a phone.
  - `POST /api/auth/code/verify` — max 5 attempts then locked (429); purpose
    `signup` flips `phone_verified` (FR-3), purpose `reset` returns a 10-min
    `reset_token`.
  - `POST /api/auth/code/password-reset` — swaps token for a new password and
    returns an auto-login token (FR-4).
  - `POST /api/vehicles` + GET/PATCH/DELETE — first vehicle auto-default,
    exactly-one-default enforced (FR-12/FR-13/FR-14). Frontend `VehiclesScreen`
    at `/vehicles`; a skippable-at-signup gate forces a vehicle before the
    first request.
  - Frontend: `VerifyCodeCard` (components/verify.tsx) shared by signup,
    sign-in (unverified accounts) and the request gate; forgot-password flow
    lives in `screens/auth.tsx` (`/auth`).
- **REQUEST** (`screens/customer/home.tsx`):
  - Triage: 6 symptoms; `wont_start`/`flat_tyre` get a follow-up yes/no
    question with skip (FR-15/16/17/21). Client mirrors the table in
    `lib/triage.ts`; server (`services/triage.py`) is authoritative.
  - Details: map pin + vehicle + fuel type/litres (cap 20 L, FR-19) + address
    + note + photo.
  - Match+quote: `POST /api/quote` returns `providers` ranked by ETA (FR-24)
    or `coverage:false` + `nearest_stations` (FR-25). Fuel unit price clamps
    to the ZERA ceiling; an explicit over-cap station → 422 (FR-26/27).
  - Confirm & pay: `POST /api/orders` accepts `vehicle_id`, `client_request_id`
    (idempotency, NFR-5), `payment_method` + `payer_phone` → Payment marked
    **HELD**, provider not settled until handover (FR-29). Success returns the
    order id stub. `screens/customer/active-order.tsx` treats `held` as
    settled, so tracking + handover-OTP continue as before. Cancel before
    acceptance is free (FR-23). Unverified → 403 (FR-3); no vehicle → 422.
  - Offline: no-data fallback queues the request in localStorage
    (`lib/offline.ts`) and offers a pre-filled `sms:` link to the emergency
    line; panic control (`tel:`) present on every step.
  - Legacy `PaymentScreen` remains for orders without a held payment.

## Component library (`frontend/src/ui/`)
Presentational only: props in, no data fetching, no localStorage. Screens
compose the library and own demo state; callbacks are `onXxx` props.

### Design tokens — `frontend/tailwind.config.ts` (extend colors)
`base #0B1416 · surface #16221F · border #24322F · lime #DDF247 · lime-ink
#2B3A0B · text #F2F5F0 · muted #8A9A96 · danger #FF7A6E · success #7BC96F ·
warn #F2A623 · blue #5EA8FF`. Radius: card 12 / tile 10 / control 8.
No hex in JSX. Never use `text-base` as a color (font-size collision).

### Rules (enforced)
- Lime = primary action + active nav ONLY (spec exceptions: JobRequestCard
  Accept, OtpDisplay digits).
- Danger = panic control, dispute entry, unread badge ONLY. Decline is always
  ghost, never red.
- Success = verified/compliant states only.
- `Money` component for all USD amounts.
- 44px minimum tap targets (`min-h-11`).
- Every component renders correctly with empty arrays.
- Sentence-case labels.

### Components
- Core: `icons.tsx` (35 icons), `types.ts`, `cn.ts`, `ui.css`.
- Primitives: `Card, KpiCard, StatusPill, VerifiedBadge, Button, Money,
  StockBar, ProgressStepper, EmptyState, MapCanvas`.
- Provider: `AppShell, SidebarNav, TopBar, ProviderIdentityCard, KpiRow,
  LiveJobMap, IncomingJobsPanel, JobRequestCard, ComplianceCard,
  FuelStockCard, EarningsSummary, RecentJobsTable, SupportCard`.
- Motorist: `MobileShell, BottomTabBar, LocationHeader, ServiceGrid,
  UnsafeButton, OfflineHint, EtaHeader, CourierCard, ShareTripButton,
  OtpDisplay, OrderSummaryCard, CompliancePill, ConfirmHandover,
  ReportProblem, FleetAccount, StepHeader, StationCard, GarageCard`.
- Driver: `ActiveJobCard, AvailabilityToggle`.
- Screens (mock data, presentational): `ProviderDashboardScreen` (gas
  station), `MotoristAppScreen` (client), `GarageDashboardScreen` (garage),
  `DriverAppScreen` (driver).

### Map
`MapCanvas` wraps Leaflet: numeric `height` prop (pixel height guaranteed),
`ResizeObserver → invalidateSize()`, CARTO dark tiles, tone-coloured
`divIcon` pins (`.ui-pin--{lime,success,blue,muted,warn}`). `center` must be
a stable reference (module constant), never an inline array literal. Harare
centre: `[-17.8292, 31.0522]`.

## App wiring / previews
- `main.tsx` imports `styles.css` (legacy, unlayered → wins over Tailwind's
  layered output) then `ui/ui.css`.
- `App.tsx`: preview routes `/design`, `/motorist`, `/garage`, `/driver`
  render before the auth gate (reachable logged-out). Pre-auth `/` → new
  `WelcomeScreen` (OPEN coverage check); `/auth` → `AuthScreen` (sign
  in/sign up/verify/reset). Customer tabs: Request `/`, Prices `/prices`,
  Orders `/orders`, Vehicles `/vehicles`, Settings `/settings`. Supplier
  sidebar + auth screen retain preview links.
- Legacy screens: `screens/auth.tsx`, `screens/customer/*`, `screens/supplier/*`,
  `screens/settings.tsx`, `src/state.tsx` (session/theme/toast).

## Verified
`npm run lint` (tsc --noEmit) clean; `npm run build` produces both entries;
routes `/`, `/auth`, `/design`, `/motorist`, `/garage`, `/driver` serve 200 on
`:5173`; vite proxy verified end-to-end (`/api/health`, `/api/coverage`).
Backend smoke test 97/97 PASS on a fresh DB.

## Next steps (not started)
1. Backend `business_type` (garage vs station) on supplier profiles; filter
   job matching by job type. Add a `driver` actor/role.
2. Wire the remaining library screens (`MotoristAppScreen` etc.) to the live
   API, or retire them as pure design gallery.
3. Firebase migration: real config into `frontend/src/lib/firebase.ts`; move
   Auth/db/storage from FastAPI to Firebase.
4. Live SMS provider behind `fuellink_sms_mode` (currently `mock`).
5. Cleanup pass: MobileShell centring + lime-rule violations.
