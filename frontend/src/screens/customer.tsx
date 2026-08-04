import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon, Loader, type IconName } from "../components/brand";
import { MapView, type MapMarker } from "../components/map";
import {
  EmptyState,
  Field,
  PumpReadout,
  QuoteLedger,
  Segmented,
  Sheet,
  StatusTimeline,
  TopBar,
} from "../components/ui";
import {
  api,
  ApiError,
  trackOrder,
  type FuelPrices,
  type Order,
  type PaymentMethod,
  type Quote,
  type ServiceItem,
  type ServiceType,
  type Station,
  type TrackingFrame,
} from "../lib/api";
import { useSession, useToast } from "../state";

const HARARE: [number, number] = [-17.8252, 31.0335];
const LITRE_PRESETS = [5, 10, 20, 40];
const SERVICE_ICONS: Record<string, IconName> = {
  nozzle: "nozzle",
  tow: "tow",
  battery: "battery",
  tyre: "tyre",
  key: "key",
  wrench: "wrench",
};

function useMyLocation() {
  const [position, setPosition] = useState<[number, number]>(HARARE);
  const [precise, setPrecise] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setPrecise(true);
      },
      () => setPrecise(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(locate, [locate]);
  return { position, precise, locate };
}

/* ── Home: map + request builder ─────────────────────────────────────── */

export function CustomerHome() {
  const { notify } = useToast();
  const { position, precise, locate } = useMyLocation();

  const [pin, setPin] = useState<[number, number]>(position);
  const [recenter, setRecenter] = useState("init");
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [service, setService] = useState<ServiceType>("fuel");
  const [fuelType, setFuelType] = useState("petrol");
  const [litres, setLitres] = useState(20);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState<number | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [active, setActive] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const debounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    setPin(position);
    setRecenter(`${position[0]},${position[1]}`);
  }, [position]);

  useEffect(() => {
    Promise.all([api.services(), api.activeOrder()])
      .then(([list, order]) => {
        setServices(list);
        setActive(order);
      })
      .catch(() => notify("Cannot reach the FuelLink server.", "error"))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => {
    if (active) return;
    api
      .stationsNearby(pin[0], pin[1], service === "fuel" ? fuelType : undefined)
      .then(setStations)
      .catch(() => setStations([]));
  }, [pin, fuelType, service, active]);

  useEffect(() => {
    if (active) return;
    window.clearTimeout(debounce.current);
    setQuoting(true);
    debounce.current = window.setTimeout(() => {
      api
        .quote({
          pickup_lat: pin[0],
          pickup_lng: pin[1],
          service_type: service,
          fuel_type: service === "fuel" ? fuelType : null,
          quantity_litres: service === "fuel" ? litres : 0,
          station_id: stationId,
        })
        .then((q) => setQuote(q))
        .catch(() => setQuote(null))
        .finally(() => setQuoting(false));
    }, 350);
    return () => window.clearTimeout(debounce.current);
  }, [pin, service, fuelType, litres, stationId, active]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = stations.map((s) => ({
      id: `station-${s.id}`,
      lat: s.lat,
      lng: s.lng,
      kind: "station",
      glyph: "⛽",
      label: `${s.name} · ${s.distance_km.toFixed(1)} km`,
      onClick: () => setStationId(s.id),
    }));
    list.push({ id: "pickup", lat: pin[0], lng: pin[1], kind: "pickup", glyph: "◎" });
    return list;
  }, [stations, pin]);

  async function placeOrder() {
    if (!quote) return;
    setPlacing(true);
    try {
      const order = await api.createOrder({
        pickup_lat: pin[0],
        pickup_lng: pin[1],
        service_type: service,
        fuel_type: service === "fuel" ? fuelType : null,
        quantity_litres: service === "fuel" ? litres : 0,
        station_id: stationId,
        pickup_address: quote.station ? `Near ${quote.station.name}` : "Dropped pin",
        notes: notes || null,
      });
      setActive(order);
      notify(`Request ${order.reference} sent. Pay to release it to suppliers.`);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not place the request.", "error");
    } finally {
      setPlacing(false);
    }
  }

  if (loading) return <Loader label="Waking the dispatcher" />;
  if (active) return <ActiveOrder order={active} onCleared={() => setActive(null)} />;

  const chosen = services.find((s) => s.id === service);

  return (
    <div className="screen" style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapView
          center={pin}
          markers={markers}
          onCenterChange={(lat, lng) => setPin([lat, lng])}
          recenterKey={recenter}
        />
      </div>

      <div style={{ position: "relative", marginTop: "auto", zIndex: 400 }}>
        <div className="row" style={{ justifyContent: "flex-end", padding: "0 16px 10px" }}>
          <button type="button" className="btn btn--sm" onClick={locate}>
            <Icon name="target" size={16} />
            {precise ? "Recentre" : "Use my GPS"}
          </button>
        </div>

        <Sheet>
          <div className="stack">
            <div className="between">
              <div>
                <p className="eyebrow">Pin dropped at</p>
                <p className="data small">
                  {pin[0].toFixed(4)}, {pin[1].toFixed(4)}
                </p>
              </div>
              {quote?.station && (
                <span className="chip chip--static">
                  <Icon name="map" size={14} />
                  {quote.station.distance_km.toFixed(1)} km out
                </span>
              )}
            </div>

            <div className="scroller">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip"
                  aria-pressed={service === s.id}
                  onClick={() => setService(s.id)}
                >
                  <Icon name={SERVICE_ICONS[s.icon] ?? "wrench"} size={15} />
                  {s.name}
                </button>
              ))}
            </div>

            {service === "fuel" ? (
              <>
                <Segmented
                  value={fuelType}
                  onChange={setFuelType}
                  options={[
                    { value: "petrol", label: "Petrol" },
                    { value: "diesel", label: "Diesel" },
                  ]}
                />
                <div className="scroller">
                  {LITRE_PRESETS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="chip"
                      aria-pressed={litres === amount}
                      onClick={() => setLitres(amount)}
                    >
                      {amount} L
                    </button>
                  ))}
                  <label className="chip chip--static" style={{ gap: 4 }}>
                    <input
                      type="number"
                      value={litres}
                      min={1}
                      max={200}
                      onChange={(e) => setLitres(Math.max(1, Number(e.target.value) || 1))}
                      style={{
                        width: 52,
                        minHeight: 0,
                        padding: 0,
                        border: 0,
                        background: "transparent",
                      }}
                      aria-label="Custom litres"
                    />
                    L
                  </label>
                </div>
              </>
            ) : (
              <p className="small muted">{chosen?.blurb}</p>
            )}

            {stations.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <p className="eyebrow">Dispatch from</p>
                {stations.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="station"
                    aria-pressed={stationId === s.id}
                    onClick={() => setStationId(stationId === s.id ? null : s.id)}
                  >
                    <img src={s.photo_url ?? ""} alt="" />
                    <div className="grow">
                      <div className="between">
                        <strong style={{ fontSize: 14 }}>{s.name}</strong>
                        <span className="data small acid">{s.distance_km.toFixed(1)} km</span>
                      </div>
                      <p className="small muted">{s.address}</p>
                      <p className="small data" style={{ marginTop: 3 }}>
                        P ${s.petrol_price.toFixed(2)} · D ${s.diesel_price.toFixed(2)}
                        {s.is_24h && <span className="acid"> · 24h</span>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <Field
              label="Note for the supplier (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Silver Toyota Wish, hazards on"
            />

            {quote ? (
              <>
                <PumpReadout amount={quote.total_amount} caption="Total to pay" />
                <QuoteLedger quote={quote} />
                <p className="small muted">
                  Arrives in about {quote.eta_minutes} minutes.
                </p>
              </>
            ) : (
              <p className="small muted">
                {quoting ? "Pricing…" : "No supplier covers that pin. Move it closer to town."}
              </p>
            )}

            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={!quote || placing || quoting}
              onClick={placeOrder}
            >
              {placing ? <span className="spinner" /> : `Request ${chosen?.name ?? "service"}`}
            </button>
          </div>
        </Sheet>
      </div>
    </div>
  );
}

/* ── Active order: pay, then track ───────────────────────────────────── */

function ActiveOrder({ order, onCleared }: { order: Order; onCleared: () => void }) {
  const { notify } = useToast();
  const [current, setCurrent] = useState(order);
  const [frame, setFrame] = useState<TrackingFrame | null>(null);
  const paid = current.payment_status === "paid" || current.payment_status === "awaiting_confirmation";

  useEffect(() => {
    const stop = trackOrder(order.id, setFrame);
    return stop;
  }, [order.id]);

  useEffect(() => {
    if (!frame) return;
    setCurrent((prev) => ({
      ...prev,
      status: frame.status,
      payment_status: frame.payment_status,
      supplier_lat: frame.supplier_lat,
      supplier_lng: frame.supplier_lng,
      eta_minutes: frame.eta_minutes,
    }));
  }, [frame]);

  async function cancel() {
    try {
      await api.setOrderStatus(current.id, "cancelled");
      notify("Request cancelled.");
      onCleared();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not cancel.", "error");
    }
  }

  async function rate(stars: number) {
    try {
      await api.rateOrder(current.id, stars);
      notify("Thanks — rating saved.");
      onCleared();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not save the rating.", "error");
    }
  }

  if (!paid) {
    return <PaymentScreen order={current} onPaid={(o) => setCurrent(o)} onCancel={cancel} />;
  }

  if (current.status === "delivered") {
    return (
      <div className="screen">
        <TopBar title={current.reference} />
        <div className="pad stack">
          <EmptyState
            icon="check"
            title="Delivered"
            body={`${current.quantity_litres || ""} ${current.quantity_litres ? "litres" : "Job"} completed for $${current.total_amount.toFixed(2)}.`}
          />
          <p className="eyebrow" style={{ textAlign: "center" }}>
            Rate your supplier
          </p>
          <div className="row" style={{ justifyContent: "center", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className="btn btn--sm" onClick={() => rate(n)}>
                {n}★
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--block" onClick={onCleared}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  const supplierAt: [number, number] | null =
    current.supplier_lat != null && current.supplier_lng != null
      ? [current.supplier_lat, current.supplier_lng]
      : null;

  const markers: MapMarker[] = [
    {
      id: "pickup",
      lat: current.pickup_lat,
      lng: current.pickup_lng,
      kind: "pickup",
      glyph: "◎",
      label: "You",
    },
  ];
  if (supplierAt) {
    markers.push({
      id: "supplier",
      lat: supplierAt[0],
      lng: supplierAt[1],
      kind: "supplier",
      glyph: "▲",
      label: frame?.supplier_name ?? "Supplier",
    });
  }

  return (
    <div className="screen" style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapView
          center={supplierAt ?? [current.pickup_lat, current.pickup_lng]}
          markers={markers}
          route={supplierAt ? [supplierAt, [current.pickup_lat, current.pickup_lng]] : null}
        />
      </div>

      <div style={{ position: "relative", marginTop: "auto", zIndex: 400 }}>
        <Sheet>
          <div className="stack">
            <div className="between">
              <div>
                <p className="eyebrow">Order {current.reference}</p>
                <h2 style={{ marginTop: 4 }}>
                  {current.status === "pending"
                    ? "Finding a supplier"
                    : current.status === "arrived"
                      ? "Your supplier is here"
                      : `${frame?.eta_minutes ?? current.eta_minutes} min away`}
                </h2>
              </div>
              <span className="row" style={{ gap: 6 }}>
                <span className={`dot ${current.status === "pending" ? "dot--warn" : "dot--live"}`} />
                <span className="eyebrow">{current.status.replace("_", " ")}</span>
              </span>
            </div>

            {frame?.supplier_name && (
              <div className="tile between">
                <div>
                  <strong>{frame.supplier_name}</strong>
                  <p className="small muted">
                    {frame.remaining_km.toFixed(1)} km out
                    {current.station ? ` · from ${current.station.name}` : ""}
                  </p>
                </div>
                <a className="btn btn--sm" href={`tel:${frame.supplier_phone ?? ""}`}>
                  <Icon name="phone" size={15} />
                  Call
                </a>
              </div>
            )}

            <StatusTimeline status={current.status} />

            <div className="tile">
              <QuoteLedger
                quote={{
                  distance_km: current.distance_km,
                  unit_price:
                    current.quantity_litres > 0 ? current.fuel_cost / current.quantity_litres : 0,
                  fuel_cost: current.fuel_cost,
                  delivery_fee: current.delivery_fee,
                  service_fee: current.service_fee,
                  total_amount: current.total_amount,
                  eta_minutes: current.eta_minutes,
                  currency: "USD",
                  breakdown_note: "",
                  station: null,
                }}
              />
            </div>

            {current.status === "pending" && (
              <button type="button" className="btn btn--danger btn--block" onClick={cancel}>
                Cancel request
              </button>
            )}
          </div>
        </Sheet>
      </div>
    </div>
  );
}

/* ── Payment ─────────────────────────────────────────────────────────── */

function PaymentScreen({
  order,
  onPaid,
  onCancel,
}: {
  order: Order;
  onPaid: (order: Order) => void;
  onCancel: () => void;
}) {
  const { user } = useSession();
  const { notify } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [method, setMethod] = useState("ecocash");
  const [phone, setPhone] = useState(user?.phone_number ?? "");
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);

  useEffect(() => {
    api.paymentMethods().then(setMethods).catch(() => setMethods([]));
  }, []);

  const selected = methods.find((m) => m.id === method);

  async function pay() {
    setBusy(true);
    try {
      const payment = await api.initiatePayment(order.id, method, phone);
      setInstructions(payment.instructions);
      if (payment.redirect_url) {
        window.location.href = payment.redirect_url;
        return;
      }
      const fresh = await api.order(order.id);
      onPaid(fresh);
      notify(
        payment.status === "paid" ? "Payment received. Dispatching now." : "Approve it on your phone.",
      );
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Payment could not start.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <TopBar title="Pay to dispatch" />
      <div className="pad stack">
        <PumpReadout amount={order.total_amount} caption={`Order ${order.reference}`} />

        <p className="eyebrow">Pay with</p>
        <div className="stack" style={{ gap: 8 }}>
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              className="station"
              aria-pressed={method === m.id}
              onClick={() => setMethod(m.id)}
              style={{ alignItems: "center" }}
            >
              <span
                className="row"
                style={{
                  width: 46,
                  height: 46,
                  justifyContent: "center",
                  borderRadius: 12,
                  background: "var(--frost-strong)",
                  flex: "none",
                }}
              >
                <Icon name={m.kind === "offline" ? "wallet" : "phone"} size={20} />
              </span>
              <div className="grow">
                <div className="between">
                  <strong style={{ fontSize: 14 }}>{m.name}</strong>
                  {!m.live && <span className="eyebrow">test mode</span>}
                </div>
                <p className="small muted">{m.note}</p>
              </div>
            </button>
          ))}
        </div>

        {selected?.requires_phone && (
          <Field
            label="Number to charge"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            hint={
              selected.prefixes.length
                ? `Accepts ${selected.prefixes.join(", ")} numbers.`
                : undefined
            }
          />
        )}

        {instructions && <div className="tile small">{instructions}</div>}

        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={pay}>
          {busy ? <span className="spinner" /> : `Pay $${order.total_amount.toFixed(2)}`}
        </button>
        <button type="button" className="btn btn--danger btn--block" onClick={onCancel}>
          Cancel request
        </button>
      </div>
    </div>
  );
}

/* ── Prices tab ──────────────────────────────────────────────────────── */

export function PricesScreen() {
  const { position } = useMyLocation();
  const [prices, setPrices] = useState<FuelPrices | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      setBusy(true);
      try {
        const [p, s] = await Promise.all([
          api.fuelPrices(refresh),
          api.stationsNearby(position[0], position[1]),
        ]);
        setPrices(p);
        setStations(s);
      } finally {
        setBusy(false);
      }
    },
    [position],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="screen">
      <TopBar
        title="Fuel prices"
        action={
          <button type="button" className="btn btn--sm" onClick={() => load(true)} disabled={busy}>
            {busy ? <span className="spinner" /> : "Refresh"}
          </button>
        }
      />
      <div className="pad stack">
        {prices ? (
          <>
            <div className="grid-2">
              <div className="tile">
                <p className="eyebrow">Petrol</p>
                <p className="data acid" style={{ fontSize: 26, fontWeight: 600 }}>
                  ${prices.petrol_price.toFixed(2)}
                </p>
                <p className="small muted">per litre</p>
              </div>
              <div className="tile">
                <p className="eyebrow">Diesel</p>
                <p className="data acid" style={{ fontSize: 26, fontWeight: 600 }}>
                  ${prices.diesel_price.toFixed(2)}
                </p>
                <p className="small muted">per litre</p>
              </div>
            </div>

            <div className="tile row" style={{ alignItems: "flex-start", gap: 10 }}>
              <span className={`dot ${prices.is_live ? "dot--live" : "dot--warn"}`} style={{ marginTop: 6 }} />
              <div>
                <p className="small">
                  {prices.is_live
                    ? `Live from ${prices.source}, ${prices.effective_period}.`
                    : "Live lookup unavailable right now — showing the last cached figure."}
                </p>
                {prices.source_url && (
                  <a
                    className="small acid"
                    href={prices.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check the source
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <Loader label="Fetching prices" />
        )}

        <p className="eyebrow">Stations near you</p>
        {stations.map((s) => (
          <div key={s.id} className="station" style={{ cursor: "default" }}>
            <img src={s.photo_url ?? ""} alt="" />
            <div className="grow">
              <div className="between">
                <strong style={{ fontSize: 14 }}>{s.name}</strong>
                <span className="data small acid">{s.distance_km.toFixed(1)} km</span>
              </div>
              <p className="small muted">{s.address}</p>
              <p className="small data" style={{ marginTop: 3 }}>
                {s.has_petrol ? `P $${s.petrol_price.toFixed(2)}` : "No petrol"} ·{" "}
                {s.has_diesel ? `D $${s.diesel_price.toFixed(2)}` : "No diesel"}
                {s.is_24h && <span className="acid"> · 24h</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Activity tab ────────────────────────────────────────────────────── */

export function ActivityScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api.orders().then(setOrders).catch(() => setOrders([]));
  }, []);

  if (!orders) return <Loader label="Loading your trips" />;

  return (
    <div className="screen">
      <TopBar title="Activity" />
      <div className="pad stack">
        {orders.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Nothing here yet"
            body="Your fuel deliveries and roadside callouts will show up here."
          />
        ) : (
          orders.map((o) => (
            <div key={o.id} className="tile stack" style={{ gap: 8 }}>
              <div className="between">
                <span className="row" style={{ gap: 8 }}>
                  <span
                    className={`dot ${o.status === "delivered" ? "dot--live" : o.status === "cancelled" ? "dot--off" : "dot--warn"}`}
                  />
                  <strong className="data small">{o.reference}</strong>
                </span>
                <span className="data acid">${o.total_amount.toFixed(2)}</span>
              </div>
              <p className="small">
                {o.service_type === "fuel"
                  ? `${o.quantity_litres} L ${o.fuel_type}`
                  : o.service_type.replace("_", " ")}{" "}
                · {o.pickup_address}
              </p>
              <p className="small muted">
                {new Date(o.created_at).toLocaleString()} · {o.status.replace("_", " ")}
                {o.rating ? ` · ${o.rating}★` : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
