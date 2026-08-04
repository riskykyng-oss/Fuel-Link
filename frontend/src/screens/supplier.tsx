import { useCallback, useEffect, useState } from "react";

import { Icon, Loader } from "../components/brand";
import { MapView, type MapMarker } from "../components/map";
import { EmptyState, Sheet, StatusTimeline, TopBar } from "../components/ui";
import {
  api,
  ApiError,
  type Order,
  type OrderStatus,
  type SupplierSummary,
} from "../lib/api";
import { useSession, useToast } from "../state";

const HARARE: [number, number] = [-17.8252, 31.0335];
const POLL_MS = 6000;

const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  accepted: { to: "in_transit", label: "Start driving" },
  in_transit: { to: "arrived", label: "I have arrived" },
  arrived: { to: "delivered", label: "Complete delivery" },
};

export function SupplierHome() {
  const { user, refresh } = useSession();
  const { notify } = useToast();
  const profile = user?.supplier_profile ?? null;

  const [online, setOnline] = useState(profile?.is_online ?? false);
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [jobs, setJobs] = useState<Order[]>([]);
  const [active, setActive] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<[number, number]>([
    profile?.current_lat ?? HARARE[0],
    profile?.current_lng ?? HARARE[1],
  ]);

  const load = useCallback(async () => {
    try {
      const current = await api.activeOrder();
      setActive(current);
      const [feed, stats] = await Promise.all([
        current ? Promise.resolve([]) : api.availableJobs(),
        api.supplierSummary(),
      ]);
      setJobs(feed);
      setSummary(stats);
    } catch {
      notify("Cannot reach the dispatch server.", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Push real device GPS so customers see the tanker move.
  useEffect(() => {
    if (!navigator.geolocation || !online) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(next);
        void api.pushLocation(next[0], next[1]).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [online]);

  async function toggleOnline() {
    const next = !online;
    setOnline(next);
    try {
      await api.setOnline(next);
      await refresh();
      notify(next ? "You are online. Jobs will come through." : "You are offline.");
    } catch {
      setOnline(!next);
      notify("Could not change your status.", "error");
    }
  }

  async function accept(order: Order) {
    try {
      setActive(await api.acceptOrder(order.id));
      notify(`Job ${order.reference} is yours.`);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "That job is gone.", "error");
      void load();
    }
  }

  if (loading) return <Loader label="Opening dispatch" />;
  if (active) {
    return <ActiveJob order={active} position={position} onDone={() => void load()} />;
  }

  const markers: MapMarker[] = jobs.map((j) => ({
    id: `job-${j.id}`,
    lat: j.pickup_lat,
    lng: j.pickup_lng,
    kind: "pickup",
    glyph: "◎",
    label: `${j.reference} · $${j.total_amount.toFixed(2)}`,
  }));
  markers.push({
    id: "me",
    lat: position[0],
    lng: position[1],
    kind: "supplier",
    glyph: "▲",
    label: "You",
  });

  return (
    <div className="screen" style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapView center={position} markers={markers} zoom={12} />
      </div>

      <div style={{ position: "relative", marginTop: "auto", zIndex: 400 }}>
        <Sheet>
          <div className="stack">
            <div className="between">
              <div>
                <p className="eyebrow">{profile?.company_name ?? "Supplier"}</p>
                <h2 style={{ marginTop: 4 }}>
                  {online ? "You are online" : "You are offline"}
                </h2>
              </div>
              <button
                type="button"
                className={online ? "btn btn--sm" : "btn btn--primary btn--sm"}
                onClick={toggleOnline}
              >
                <span className={`dot ${online ? "dot--live" : "dot--off"}`} />
                {online ? "Go offline" : "Go online"}
              </button>
            </div>

            {profile && !profile.is_verified && (
              <div className="tile row" style={{ alignItems: "flex-start", gap: 10 }}>
                <span className="dot dot--warn" style={{ marginTop: 6 }} />
                <p className="small">
                  Licence {profile.zera_licence_number} is awaiting review. You can still take
                  jobs; customers see an unverified badge until it clears.
                </p>
              </div>
            )}

            {summary && (
              <div className="grid-2">
                <div className="tile">
                  <p className="eyebrow">Earned</p>
                  <p className="data acid" style={{ fontSize: 22, fontWeight: 600 }}>
                    ${summary.total_earnings.toFixed(2)}
                  </p>
                </div>
                <div className="tile">
                  <p className="eyebrow">Jobs done</p>
                  <p className="data acid" style={{ fontSize: 22, fontWeight: 600 }}>
                    {summary.completed_jobs}
                  </p>
                </div>
                <div className="tile">
                  <p className="eyebrow">Litres out</p>
                  <p className="data" style={{ fontSize: 18 }}>{summary.litres_delivered}</p>
                </div>
                <div className="tile">
                  <p className="eyebrow">Rating</p>
                  <p className="data" style={{ fontSize: 18 }}>{summary.rating.toFixed(1)} ★</p>
                </div>
              </div>
            )}

            <p className="eyebrow">
              Open requests {jobs.length > 0 && <span className="acid">· {jobs.length}</span>}
            </p>

            {!online ? (
              <EmptyState
                icon="target"
                title="Go online to see work"
                body="Requests within 20 km of your tanker appear here the moment they are paid."
              />
            ) : jobs.length === 0 ? (
              <EmptyState
                icon="clock"
                title="Nothing waiting"
                body="Stay online and the next request in your radius will land here."
              />
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="tile stack" style={{ gap: 10 }}>
                  <div className="between">
                    <div>
                      <strong className="data small">{job.reference}</strong>
                      <p style={{ fontSize: 15, marginTop: 2 }}>
                        {job.service_type === "fuel"
                          ? `${job.quantity_litres} L ${job.fuel_type}`
                          : job.service_type.replace("_", " ")}
                      </p>
                    </div>
                    <span className="data acid" style={{ fontSize: 18 }}>
                      ${job.total_amount.toFixed(2)}
                    </span>
                  </div>
                  <p className="small muted">
                    {job.pickup_address} · {job.distance_km.toFixed(1)} km · about{" "}
                    {job.eta_minutes} min
                  </p>
                  {job.notes && <p className="small">“{job.notes}”</p>}
                  <div className="row" style={{ gap: 8 }}>
                    <span className="chip chip--static">
                      You keep ${(job.delivery_fee + job.service_fee).toFixed(2)}
                    </span>
                    {job.payment_status === "paid" && (
                      <span className="chip chip--static acid">Prepaid</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={() => accept(job)}
                  >
                    Accept job
                  </button>
                </div>
              ))
            )}
          </div>
        </Sheet>
      </div>
    </div>
  );
}

function ActiveJob({
  order,
  position,
  onDone,
}: {
  order: Order;
  position: [number, number];
  onDone: () => void;
}) {
  const { notify } = useToast();
  const [current, setCurrent] = useState(order);
  const [me, setMe] = useState<[number, number]>(
    order.supplier_lat != null && order.supplier_lng != null
      ? [order.supplier_lat, order.supplier_lng]
      : position,
  );
  const [busy, setBusy] = useState(false);

  const step = NEXT_STEP[current.status];

  async function advance() {
    if (!step) return;
    setBusy(true);
    try {
      const updated = await api.setOrderStatus(current.id, step.to);
      setCurrent(updated);
      if (step.to === "delivered") {
        notify(`Job ${updated.reference} completed.`);
        onDone();
      }
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not update the job.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    try {
      const point = await api.demoDrive(current.id);
      setMe([point.lat, point.lng]);
    } catch {
      notify("Demo drive needs the job to be accepted first.", "error");
    }
  }

  const markers: MapMarker[] = [
    {
      id: "pickup",
      lat: current.pickup_lat,
      lng: current.pickup_lng,
      kind: "pickup",
      glyph: "◎",
      label: current.customer.full_name,
    },
    { id: "me", lat: me[0], lng: me[1], kind: "supplier", glyph: "▲", label: "You" },
  ];

  return (
    <div className="screen" style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapView
          center={me}
          markers={markers}
          route={[me, [current.pickup_lat, current.pickup_lng]]}
          recenterKey={`${me[0]},${me[1]}`}
        />
      </div>

      <div style={{ position: "relative", marginTop: "auto", zIndex: 400 }}>
        <Sheet>
          <div className="stack">
            <div className="between">
              <div>
                <p className="eyebrow">Job {current.reference}</p>
                <h2 style={{ marginTop: 4 }}>
                  {current.service_type === "fuel"
                    ? `${current.quantity_litres} L ${current.fuel_type}`
                    : current.service_type.replace("_", " ")}
                </h2>
              </div>
              <span className="data acid" style={{ fontSize: 20 }}>
                ${(current.delivery_fee + current.service_fee).toFixed(2)}
              </span>
            </div>

            <div className="tile between">
              <div>
                <strong>{current.customer.full_name}</strong>
                <p className="small muted">{current.pickup_address}</p>
              </div>
              <a className="btn btn--sm" href={`tel:${current.customer.phone_number}`}>
                <Icon name="phone" size={15} />
                Call
              </a>
            </div>

            {current.notes && <p className="small">“{current.notes}”</p>}

            <StatusTimeline status={current.status} />

            <div className="row" style={{ gap: 8 }}>
              <a
                className="btn grow"
                href={`https://www.openstreetmap.org/directions?from=${me[0]},${me[1]}&to=${current.pickup_lat},${current.pickup_lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="map" size={16} />
                Directions
              </a>
              <button type="button" className="btn" onClick={simulate}>
                Demo drive
              </button>
            </div>

            {step && (
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={advance}
                disabled={busy}
              >
                {busy ? <span className="spinner" /> : step.label}
              </button>
            )}
          </div>
        </Sheet>
      </div>
    </div>
  );
}

export function SupplierJobs() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api.orders().then(setOrders).catch(() => setOrders([]));
  }, []);

  if (!orders) return <Loader label="Loading jobs" />;

  const delivered = orders.filter((o) => o.status === "delivered");
  const earned = delivered.reduce((sum, o) => sum + o.delivery_fee + o.service_fee, 0);

  return (
    <div className="screen">
      <TopBar title="Earnings" />
      <div className="pad stack">
        <div className="tile">
          <p className="eyebrow">Lifetime payout</p>
          <p className="data acid" style={{ fontSize: 30, fontWeight: 600 }}>
            ${earned.toFixed(2)}
          </p>
          <p className="small muted">
            From {delivered.length} completed {delivered.length === 1 ? "job" : "jobs"}. Fuel cost
            is settled to the station, not to you.
          </p>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon="clock"
            title="No jobs yet"
            body="Accepted work shows here with the payout you kept."
          />
        ) : (
          orders.map((o) => (
            <div key={o.id} className="tile between">
              <div>
                <strong className="data small">{o.reference}</strong>
                <p className="small muted">
                  {new Date(o.created_at).toLocaleDateString()} · {o.status.replace("_", " ")}
                </p>
              </div>
              <span className="data acid">
                ${(o.delivery_fee + o.service_fee).toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
