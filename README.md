# FuelLink

Emergency fuel delivery and roadside assistance for Harare. Two apps in one:
motorists request fuel where they are stranded, suppliers accept and run the
job, and both sides watch the same live map.

Built from the FuelLink system documentation (Chapters 1–4). Palette is
Chartreuse `#e0ff4f` on Gun Metal `#00272b`.

---

## Run it

Two terminals. Backend first.

### 1. Backend (Python / FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env
python run.py
```

API on <http://localhost:8000>, interactive docs on <http://localhost:8000/docs>.
The database seeds itself on first boot — no migrations to run.

### 2. Frontend (React / Vite)

```bash
cd frontend
npm install
npm run dev
```

App on <http://localhost:5173>.

### Sign in

| Role     | Phone        | Password      |
|----------|--------------|---------------|
| Motorist | `0771234567` | `password123` |
| Supplier | `0782345678` | `password123` |

Or register — the two sign-up forms collect different things. Motorists give a
vehicle (make, model, plate, tank size); suppliers give a ZERA licence number,
vehicle registration, tanker capacity and the services they carry.

### Check the backend on its own

```bash
cd backend && .venv/bin/python smoke_test.py
```

Runs 40 checks across auth, pricing, dispatch, tracking, payment and ratings.

---

## What's in it

**Motorist**
Live map with your pin, drag-to-move pickup, nearby stations sorted by distance
with forecourt cards, fuel type and litre selection, live quote breakdown,
dispatch, supplier tracking with a moving marker and shrinking ETA, payment,
rating, order history.

**Supplier**
Job feed filtered to a 20 km radius, accept/reject, status ladder
(accepted → in transit → arrived → delivered), GPS push, earnings ledger,
online/offline toggle.

**Both**
Theme switch (system / light / dark), language, notification preferences, saved
places, payment methods, safety centre with emergency contacts, help, profile
editing. Frosted-glass surfaces throughout — translucency and blur, no glow.

**Roadside assistance**
Towing, jump start, tyre change, lockout, battery. Each carries a call-out fee
on top of the distance charge, the pattern recovery operators actually use.

---

## How the money is worked out

```
total = (fuel price × litres) + (distance_km × 3) + call-out fee
```

The `× 3` delivery multiplier is exactly as specified in your brief. It lives in
`FUELLINK_DELIVERY_RATE_MULTIPLIER` in `.env` if you want to tune it without
touching code. Distance is straight-line with a 1.3 road factor applied, so it
tracks real driving distance rather than crow-flies.

Fuel prices come from ZERA (Zimbabwe Energy Regulatory Authority), which caps
pump prices monthly. There is no public JSON API, so `services/fuel_prices.py`
scrapes the published page and caches the last good result for 12 hours. Each
station's stored price is an *offset* against that cap, not an absolute figure,
so nothing goes stale. **If the fetch fails, the app falls back to the last
cached snapshot and the UI says so** — it never presents a stale number as
current. Cold-start fallback is $1.57 petrol / $1.54 diesel.

---

## Payments

Mobile money in Zimbabwe settles through **Paynow**, which fronts EcoCash,
OneMoney, InnBucks, ZIPIT and card. `services/paynow.py` implements the Express
Checkout protocol properly: SHA-512 hash of the concatenated field values plus
your integration key, uppercased, posted to Paynow's initiate endpoint, with the
result callback verified the same way.

**Out of the box the app runs in mock mode.** No credentials, no money moved,
payments simulate success locally so you can test the whole flow end to end. The
health endpoint reports `"payments": "mock"` so you always know which mode
you're in.

To go live, register a merchant account at <https://www.paynow.co.zw>, then fill
in `.env`:

```
PAYNOW_INTEGRATION_ID=your-id
PAYNOW_INTEGRATION_KEY=your-key
```

It flips to live automatically on restart.

> There is no way around this step and no public sandbox key exists. EcoCash and
> OneMoney do not hand out API access to anonymous callers — a registered
> merchant identity is required by law, because these are regulated payment
> rails. Anyone offering you working keys is offering you someone else's.

---

## Station photography

The cards in `frontend/public/stations/` are original forecourt illustrations
coloured to each retailer's identity. They are **not** the retailers' logos and
**not** photographs of their sites — reproducing those needs either the brand's
permission or a licensed source.

The licensed route, if you want real photos: enable the Google Places API,
resolve each station to a `place_id`, then serve `places/photo` URLs. The
`Station.photo_url` column already carries whatever you put in it, so this is a
seed-data change and nothing else. Regenerate the illustrations with
`python frontend/public/stations/_generate.py`.

---

## Layout

```
backend/
  app/
    main.py            app assembly, CORS, health
    config.py          env settings
    models.py          User, Vehicle, SupplierProfile, Station,
                       Order, Payment, PriceSnapshot, Rating
    schemas.py         request/response contracts
    security.py        PBKDF2 hashing, JWT issue/verify
    seed.py            10 Harare stations + demo accounts
    routers/
      auth.py          register, login, me, profile
      orders.py        quote, create, dispatch, status ladder, history
      stations.py      nearby search, fuel prices
      payments.py      methods, initiate, Paynow callback
      services.py      towing / assistance catalogue
      tracking.py      WebSocket live position
    services/
      geo.py           haversine + road factor
      fuel_prices.py   ZERA fetch, cache, fallback
      paynow.py        Express Checkout protocol
  smoke_test.py        40-check end-to-end run
frontend/
  src/
    App.tsx            routing + role guards
    state.tsx          auth, theme, preferences
    lib/api.ts         typed API client
    components/        brand (logo, loader), map, ui (frosted primitives)
    screens/           auth, customer, supplier, settings
  public/
    icon.svg           the F-in-a-fuel-can mark
    stations/          forecourt cards
```

## Push it to GitHub

```bash
git remote add origin https://github.com/JeyKayAm/fuellink.git
git branch -M main
git push -u origin main
```

`.env`, `.venv`, `node_modules` and `fuellink.db` are already ignored.
