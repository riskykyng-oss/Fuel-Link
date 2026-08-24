import { useEffect, useMemo, useState } from "react";

import { Icon, Loader, type IconName } from "../../components/brand";
import { MapView, type MapMarker } from "../../components/map";
import { EmptyState } from "../../components/ui";
import {
  api,
  type Order,
  type SealedContainer,
  type SupplierSummary,
} from "../../lib/api";
import { SERVICE_CATALOGUE, serviceIcon, serviceLabel } from "../../lib/services";
import { useToast } from "../../state";

/* ── KPI row ─────────────────────────────────────────────────────────── */

export function Kpis({
  summary,
  requests,
  orders,
}: {
  summary: SupplierSummary | null;
  requests: Order[];
  orders: Order[];
}) {
  const today = new Date().toDateString();
  const active = orders.filter((o) => ["accepted", "in_transit", "arrived"].includes(o.status)).length;
  const completedToday = orders.filter(
    (o) => o.status === "delivered" && new Date(o.created_at).toDateString() === today,
  ).length;

  const kpis: { label: string; value: string; icon: IconName; danger?: boolean }[] = [
    { label: "Pending", value: String(requests.length), icon: "route", danger: requests.length > 0 },
    { label: "Active", value: String(active), icon: "clock" },
    { label: "Done today", value: String(completedToday), icon: "check" },
    { label: "Earnings", value: `$${(summary?.earnings_today ?? 0).toFixed(0)}`, icon: "wallet" },
  ];

  return (
    <div className="kpis">
      {kpis.map((k) => (
        <div key={k.label} className={`kpi${k.danger ? " kpi--danger" : ""}`}>
          <span className="kpi__icon">
            <Icon name={k.icon} size={16} />
          </span>
          <div className="kpi__value">{k.value}</div>
          <div className="kpi__label">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Live map ────────────────────────────────────────────────────────── */

export function LiveMap({ position, requests }: { position: [number, number]; requests: Order[] }) {
  const markers: MapMarker[] = requests
    .filter((j) => j.pickup_lat != null && j.pickup_lng != null)
    .map((j) => ({
      id: `job-${j.id}`,
      lat: j.pickup_lat as number,
      lng: j.pickup_lng as number,
      kind: "pickup",
      glyph: "◎",
      label: `${j.reference} · ${serviceLabel(j.service_type)}`,
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
    <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative", minHeight: 240 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapView center={position} markers={markers} zoom={12} interactive={false} />
      </div>
    </div>
  );
}

/* ── inDrive-style Request Card ──────────────────────────────────────── */

function RequestCard({
  job,
  onAccept,
  onDecline,
  onBid,
}: {
  job: Order;
  onAccept: (o: Order) => void;
  onDecline: (o: Order) => void;
  onBid: (o: Order, amount: number, note: string) => void;
}) {
  const [bidAmount, setBidAmount] = useState(String(job.total_amount.toFixed(2)));
  const [bidNote, setBidNote] = useState("");
  const [showBid, setShowBid] = useState(false);
  const [busy, setBusy] = useState(false);

  const customerAmount = job.total_amount;

  async function submitBid() {
    const amt = parseFloat(bidAmount);
    if (isNaN(amt) || amt <= 0) return;
    setBusy(true);
    await onBid(job, amt, bidNote);
    setBusy(false);
  }

  return (
    <div className="request-card">
      <div className="between">
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <span className="request-card__icon">
            <Icon name={serviceIcon(job.service_type)} size={18} />
          </span>
          <div>
            <strong style={{ fontSize: 14 }}>{serviceLabel(job.service_type)}</strong>
            {job.service_type === "fuel" && (
              <span className="small muted"> · {job.quantity_litres.toFixed(0)} L {job.fuel_type}</span>
            )}
          </div>
        </div>
        <span className="request-card__dist">
          <Icon name="route" size={13} />
          {job.distance_km.toFixed(1)} km
        </span>
      </div>

      <div className="request-card__customer">
        <span className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
          {job.customer.full_name.charAt(0).toUpperCase()}
        </span>
        <div className="grow">
          <strong style={{ fontSize: 13 }}>{job.customer.full_name}</strong>
          {job.pickup_address && <p className="small muted">{job.pickup_address}</p>}
        </div>
      </div>

      {job.notes && <p className="small" style={{ fontStyle: "italic", marginTop: 4 }}>"{job.notes}"</p>}

      <div className="request-card__offer">
        <span className="eyebrow">Customer's offer</span>
        <span className="data acid" style={{ fontSize: 22 }}>${customerAmount.toFixed(2)}</span>
      </div>

      {!showBid ? (
        <div className="request-card__actions">
          <button type="button" className="btn btn--primary" onClick={() => onAccept(job)}>
            <Icon name="check" size={15} /> Accept
          </button>
          <button type="button" className="btn btn--bid" onClick={() => { setShowBid(true); setBidAmount(String(customerAmount.toFixed(2))); }}>
            <Icon name="wallet" size={15} /> Counter-offer
          </button>
          <button type="button" className="btn btn--decline" onClick={() => onDecline(job)}>
            Decline
          </button>
        </div>
      ) : (
        <div className="request-card__bid-form">
          <label className="field" style={{ margin: 0 }}>
            <span>Your price</span>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--acid)" }}>$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                style={{ fontFamily: "var(--data)", fontSize: 20, fontWeight: 700, flex: 1 }}
              />
            </div>
          </label>
          <input
            type="text"
            placeholder="Note (optional)"
            value={bidNote}
            onChange={(e) => setBidNote(e.target.value)}
            className="request-card__note-input"
          />
          <div className="request-card__bid-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowBid(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void submitBid()}>
              {busy ? <span className="spinner" /> : <><Icon name="send" size={15} /> Send offer</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Request queue ───────────────────────────────────────────────────── */

export function RequestQueue({
  requests,
  onAccept,
  onDecline,
  onBid,
  online,
  summary,
}: {
  requests: Order[];
  onAccept: (o: Order) => void;
  onDecline: (o: Order) => void;
  onBid: (o: Order, amount: number, note: string) => void;
  online: boolean;
  summary: SupplierSummary | null;
}) {
  if (!online) {
    return (
      <div className="card">
        <div className="card__head">
          <h3>Incoming requests</h3>
        </div>
        <EmptyState
          icon="route"
          title="You are offline"
          body="Go online to start receiving requests from customers."
        />
      </div>
    );
  }

  return (
    <div className="card" style={{ maxHeight: 520, overflowY: "auto" }}>
      <div className="card__head">
        <h3>Incoming requests</h3>
        <span className="badge">{requests.length}</span>
      </div>

      {summary && (
        <p className="small muted" style={{ padding: "0 2px 8px" }}>
          <Icon name="truck" size={13} />
          {summary.staff_on_shift ?? 0} on shift · {summary.staff_available ?? 0} ready
        </p>
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No pending requests"
          body="Stay online — customer requests will appear here."
        />
      ) : (
        requests.map((job) => (
          <RequestCard
            key={job.id}
            job={job}
            onAccept={onAccept}
            onDecline={onDecline}
            onBid={onBid}
          />
        ))
      )}
    </div>
  );
}

/* ── Compliance ──────────────────────────────────────────────────────── */

export function ComplianceCard({ summary }: { summary: SupplierSummary | null }) {
  const rows = [
    { fuel: "Petrol", cap: summary?.cap_petrol ?? null, price: summary?.petrol_price ?? null },
    { fuel: "Diesel", cap: summary?.cap_diesel ?? null, price: summary?.diesel_price ?? null },
  ];
  const verifiedAt = summary?.price_verified_at
    ? new Date(summary.price_verified_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="card">
      <div className="card__head">
        <h3>ZERA compliance</h3>
        <span className="badge badge--ok">
          <Icon name="check" size={11} /> Verified
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.fuel} style={{ marginBottom: 10 }}>
          <div className="compliance__price">
            <span className="muted">{row.fuel} cap</span>
            <span className="data">${row.cap != null ? row.cap.toFixed(2) : "…"}/L</span>
          </div>
          <div className="compliance__price">
            <span className="muted">{row.fuel} your price</span>
            <span className="data">${row.price != null ? row.price.toFixed(2) : "…"}/L</span>
          </div>
        </div>
      ))}
      {verifiedAt && (
        <p className="small muted" style={{ marginTop: 4 }}>
          Verified {verifiedAt}
          {summary?.price_is_live ? " · live" : " · cached"}
        </p>
      )}
    </div>
  );
}

/* ── Fuel stock ──────────────────────────────────────────────────────── */

export function StockCard({ summary }: { summary: SupplierSummary | null }) {
  const cap = summary?.tanker_capacity_litres ?? 0;
  const rows = [
    { fuel: "Petrol", litres: summary?.fuel_stock_petrol ?? 0 },
    { fuel: "Diesel", litres: summary?.fuel_stock_diesel ?? 0 },
  ];

  return (
    <div className="card">
      <div className="card__head">
        <h3>Fuel stock</h3>
        <span className="badge">
          <Icon name="box" size={12} /> {cap.toLocaleString()} L
        </span>
      </div>
      {rows.map((row) => {
        const pct = cap > 0 ? (row.litres / cap) * 100 : 0;
        const tone = pct < 15 ? "danger" : pct < 30 ? "warn" : "ok";
        return (
          <div key={row.fuel} className="stock__row">
            <div className="stock__head">
              <strong>{row.fuel}</strong>
              <span className="data">{row.litres.toLocaleString()} L</span>
            </div>
            <div className="stock__bar">
              <div className={`stock__fill stock__fill--${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        );
      })}
      <p className="small muted" style={{ marginTop: 6 }}>
        <Icon name="box" size={12} />
        {summary?.containers_ready ?? 0} sealed ready · {summary?.containers_in_use ?? 0} in use
      </p>
    </div>
  );
}

/* ── Sealed container fleet ──────────────────────────────────────────── */

export function SealContainers() {
  const [items, setItems] = useState<SealedContainer[] | null>(null);

  useEffect(() => {
    api.supplierContainers().then((res) => setItems(res.containers)).catch(() => setItems([]));
  }, []);

  const ready = items ? items.filter((c) => c.status !== "in_use").length : 0;

  return (
    <div className="card">
      <div className="card__head">
        <h3>Sealed containers</h3>
        <span className="badge">{items ? `${ready} ready` : "…"}</span>
      </div>
      {!items ? (
        <Loader label="Loading" />
      ) : items.length === 0 ? (
        <EmptyState icon="box" title="No containers" body="Containers are scanned at dispatch and handover." />
      ) : (
        items.map((c) => (
          <div key={c.serial} className="seal">
            <span className="seal__serial">{c.serial}</span>
            <span className="small muted">{c.capacity_litres} L</span>
            <span className={`badge ${c.status === "in_use" ? "badge--lime" : "badge--ok"}`}>
              {c.status.replace("_", " ")}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Recent jobs ─────────────────────────────────────────────────────── */

export function RecentJobs({ orders }: { orders: Order[] }) {
  const rows = orders.slice(0, 8);
  const statusBadge = (status: string) => {
    if (status === "delivered") return "badge--ok";
    if (status === "cancelled" || status === "declined") return "";
    return "badge--lime";
  };
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="card__head" style={{ padding: "18px 18px 0" }}>
        <h3>Recent jobs</h3>
        <span className="badge">{orders.length} total</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "4px 18px 18px" }}>
          <EmptyState icon="clock" title="No jobs yet" body="Accepted jobs show up here." />
        </div>
      ) : (
        <div style={{ overflowX: "auto", padding: "8px 6px 6px" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Earnings</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="row" style={{ gap: 7 }}>
                      <Icon name={serviceIcon(o.service_type)} size={15} />
                      {serviceLabel(o.service_type)}
                    </span>
                  </td>
                  <td>{o.customer?.full_name ?? "—"}</td>
                  <td>
                    <span className={`badge ${statusBadge(o.status)}`}>
                      {o.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="data">${(o.delivery_fee + o.service_fee).toFixed(2)}</td>
                  <td className="muted small">
                    {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Earnings trend ──────────────────────────────────────────────────── */

export function EarningsChart({ orders }: { orders: Order[] }) {
  const days = useMemo(() => {
    const map: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const total = orders
        .filter(
          (o) =>
            o.status === "delivered" &&
            new Date(o.created_at).toDateString() === day.toDateString(),
        )
        .reduce((sum, o) => sum + o.delivery_fee + o.service_fee, 0);
      map.push({ label: day.toLocaleDateString([], { weekday: "short" }).slice(0, 2), total });
    }
    return map;
  }, [orders]);

  const max = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className="card">
      <div className="card__head">
        <h3>Earnings</h3>
        <span className="badge">7 days</span>
      </div>
      <div className="bars">
        {days.map((d, i) => (
          <div key={i} className="bars__col">
            <div
              className="bars__bar"
              style={{ height: `${Math.max(4, (d.total / max) * 100)}%`, opacity: i === days.length - 1 ? 1 : 0.55 }}
              title={`$${d.total.toFixed(2)}`}
            />
            <span className="bars__label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Services manager ────────────────────────────────────────────────── */

export function ServicesSection({
  servicesOffered,
  onSaved,
}: {
  servicesOffered?: string;
  onSaved?: () => void;
}) {
  const { notify } = useToast();
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const offered = new Set((servicesOffered ?? "fuel").split(","));
    const initial: Record<string, boolean> = {};
    SERVICE_CATALOGUE.forEach((s) => (initial[s.id] = offered.has(s.id)));
    return initial;
  });
  const [saving, setSaving] = useState(false);

  async function save(next: Record<string, boolean>) {
    setSaving(true);
    try {
      const services = Object.entries(next).filter(([, on]) => on).map(([id]) => id);
      await api.updateSupplierProfile({ services_offered: services });
      onSaved?.();
    } catch {
      notify("Could not save service preferences.", "error");
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string) {
    const next = { ...toggles, [id]: !toggles[id] };
    setToggles(next);
    void save(next);
  }

  const enabled = Object.values(toggles).filter(Boolean).length;

  return (
    <div className="card">
      <div className="card__head">
        <h3>Services offered</h3>
        <span className={`badge${enabled > 0 ? " badge--ok" : ""}`}>
          {saving ? "Saving…" : `${enabled} active`}
        </span>
      </div>
      {SERVICE_CATALOGUE.map((s) => (
        <div key={s.id} className="svc">
          <span className="svc__icon">
            <Icon name={s.icon} size={17} />
          </span>
          <div className="grow">
            <strong style={{ fontSize: 13.5 }}>{s.label}</strong>
            <p className="small muted">${s.fee.toFixed(2)} callout</p>
          </div>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={toggles[s.id]}
            aria-label={`Toggle ${s.label}`}
            disabled={saving}
            onClick={() => toggle(s.id)}
          />
        </div>
      ))}
    </div>
  );
}
