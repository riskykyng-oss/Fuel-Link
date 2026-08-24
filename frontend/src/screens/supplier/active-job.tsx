import { useEffect, useMemo, useState } from "react";

import { Icon } from "../../components/brand";
import { MapView, type MapMarker } from "../../components/map";
import { api, ApiError, type Order, type SealedContainer } from "../../lib/api";
import { serviceLabel } from "../../lib/services";
import { useToast } from "../../state";
import type { SupplierStore } from "./useSupplier";

export function ActiveJob({ store }: { store: SupplierStore }) {
  const { active, position, load } = store;
  const { notify } = useToast();
  const [stage, setStage] = useState(active?.status ?? "accepted");
  const [seconds, setSeconds] = useState(0);
  const [hintsOpen, setHintsOpen] = useState(true);
  const [codeEntry, setCodeEntry] = useState("");
  const [sealScan, setSealScan] = useState("");
  const [sealArrive, setSealArrive] = useState("");
  const [containers, setContainers] = useState<SealedContainer[]>([]);

  const order = active!;

  useEffect(() => setStage(active?.status ?? "accepted"), [active]);
  useEffect(() => setCodeEntry(""), [active?.id]);
  useEffect(() => setSealScan(""), [active?.id]);
  useEffect(() => setSealArrive(""), [active?.id]);
  useEffect(() => setSeconds(0), [active?.id]);

  useEffect(() => {
    api.supplierContainers().then((res) => setContainers(res.containers)).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeStr = useMemo(() => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [seconds]);

  const payout = order.delivery_fee + order.service_fee;
  const isFuel = order.service_type === "fuel";

  async function advance(
    next: Order["status"],
    handoverCode?: string,
    sealId?: string,
  ) {
    if (next === "delivered" && !handoverCode) {
      notify("Enter the 4-digit code the motorist read out to you.", "error");
      return;
    }
    try {
      const updated = await api.setOrderStatus(order.id, next, handoverCode, sealId);
      setStage(updated.status);
      if (next === "delivered") {
        notify("Verified handover complete. Payout released.");
        window.setTimeout(() => void load(), 800);
      }
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not update the job.", "error");
    }
  }

  async function cancelJob() {
    try {
      const updated = await api.setOrderStatus(order.id, "cancelled");
      setStage(updated.status);
      notify("Job cancelled.");
      window.setTimeout(() => void load(), 800);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not cancel.", "error");
    }
  }

  const pickup: [number, number] = [order.pickup_lat ?? 0, order.pickup_lng ?? 0];
  const markers: MapMarker[] = [
    { id: "pickup", lat: pickup[0], lng: pickup[1], kind: "pickup", glyph: "◎", label: "Pickup" },
    { id: "me", lat: position[0], lng: position[1], kind: "supplier", glyph: "▲", label: "You" },
  ];

  const jobStage =
    stage === "accepted"
      ? "Head to the pickup pin"
      : stage === "in_transit"
        ? "Provider travelling"
        : stage === "arrived"
          ? "Handover pending"
          : stage;

  return (
    <div className="stack">
      <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative", minHeight: 320 }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <MapView center={pickup} markers={markers} route={[position, pickup]} zoom={13} interactive={false} />
        </div>
        <div
          className="badge badge--lime"
          style={{ position: "absolute", top: 12, left: 12, zIndex: 500 }}
        >
          <span className="dot dot--live" />
          {jobStage}
        </div>
        <div
          className="badge badge--lime"
          style={{ position: "absolute", bottom: 12, left: 12, zIndex: 500 }}
        >
          <Icon name="clock" size={13} />
          Elapsed {timeStr}
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h3>Active job · {order.reference}</h3>
          <span className="badge badge--lime">
            <span className="dot dot--live" />
            You are on this job
          </span>
        </div>

        <div className="active-job__grid">
          <div>
            <p className="eyebrow">Service</p>
            <p className="data" style={{ fontSize: 20 }}>
              {serviceLabel(order.service_type)}
            </p>
            {order.service_type === "fuel" && (
              <p className="small muted">
                {order.quantity_litres.toFixed(0)} L {order.fuel_type}
              </p>
            )}
          </div>
          <div>
            <p className="eyebrow">You keep</p>
            <p className="data acid" style={{ fontSize: 20 }}>
              ${payout.toFixed(2)}
            </p>
            <p className="small muted">delivery + callout</p>
          </div>
          <div>
            <p className="eyebrow">Distance</p>
            <p className="data" style={{ fontSize: 20 }}>
              {order.distance_km.toFixed(1)} km
            </p>
            <p className="small muted">to pickup</p>
          </div>
        </div>

        <div className="line" />

        <p className="eyebrow">Pickup location</p>
        <p style={{ fontSize: 14.5 }}>{order.pickup_address}</p>
        {order.notes && <p className="small">“{order.notes}”</p>}

        {order.photo_url && (
          <img
            src={order.photo_url}
            alt="Customer attachment"
            style={{
              width: "100%",
              height: 160,
              objectFit: "cover",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
              marginTop: 10,
            }}
          />
        )}

        <div className="line" />

        <p className="eyebrow">Customer</p>
        <div className="provider">
          <span className="avatar">{order.customer.full_name.charAt(0).toUpperCase()}</span>
          <div className="grow">
            <strong style={{ fontSize: 14 }}>{order.customer.full_name}</strong>
            <p className="small muted">{order.customer.phone_number}</p>
          </div>
          <a className="btn btn--sm" href={`tel:${order.customer.phone_number}`}>
            <Icon name="phone" size={15} />
            Call
          </a>
        </div>

        {order.payment_status === "paid" && (
          <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <span className="chip chip--static chip--ok">
              <Icon name="shield" size={13} />
              Prepaid by customer
            </span>
            {order.sealed_container_id && (
              <span className="chip chip--static">
                <Icon name="seal" size={13} />
                Sealed {order.sealed_container_id}
              </span>
            )}
            {order.provider_staff_id && (
              <span className="chip chip--static">
                <Icon name="id" size={13} />
                Staff {order.provider_staff_id}
              </span>
            )}
          </div>
        )}

        {stage === "arrived" && (
          <div className="handover">
            <div className="handover__head">
              <span className="badge badge--ok">
                <Icon name="shield" size={12} />
                Complete the handover
              </span>
              <p className="small muted">
                Ask the motorist to read their 4-digit code out loud, then enter it.
              </p>
            </div>
            {isFuel && (
              <label className="field" style={{ marginTop: 8 }}>
                <span>Arrival seal (confirm container)</span>
                <select
                  value={sealArrive}
                  onChange={(e) => setSealArrive(e.target.value)}
                  style={{ fontFamily: "var(--data)" }}
                >
                  <option value="">Select a container…</option>
                  {containers
                    .filter((c) => c.status === "available" || c.serial === sealScan)
                    .map((c) => (
                      <option key={c.serial} value={c.serial}>
                        {c.serial} — {c.capacity_litres} L
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="field" style={{ marginTop: 8 }}>
              <span>4-digit handover code</span>
              <input
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                style={{ fontFamily: "var(--data)", fontSize: 22, letterSpacing: "0.5em" }}
                value={codeEntry}
                onChange={(e) => setCodeEntry(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
            <p className="small muted">The code unlocks the delivery for you — never the motorist.</p>
          </div>
        )}

        {stage !== "delivered" && (
          <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {stage === "accepted" && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void advance("in_transit", undefined, isFuel ? sealScan : undefined)}
              >
                <Icon name="route" size={16} />
                Depart to pickup
              </button>
            )}
            {stage === "accepted" && isFuel && (
              <label className="field" style={{ minWidth: 220, flex: 1 }}>
                <span>Dispatch seal (select container)</span>
                <select
                  value={sealScan}
                  onChange={(e) => setSealScan(e.target.value)}
                  style={{ fontFamily: "var(--data)" }}
                >
                  <option value="">Select a container…</option>
                  {containers
                    .filter((c) => c.status === "available")
                    .map((c) => (
                      <option key={c.serial} value={c.serial}>
                        {c.serial} — {c.capacity_litres} L
                      </option>
                    ))}
                </select>
              </label>
            )}
            {stage === "in_transit" && (
              <button type="button" className="btn btn--primary" onClick={() => void advance("arrived")}>
                <Icon name="target" size={16} />
                I have arrived
              </button>
            )}
            {stage === "arrived" && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={codeEntry.trim().length !== 4 || (isFuel && !sealArrive)}
                onClick={() =>
                  void advance(
                    "delivered",
                    codeEntry,
                    isFuel ? sealArrive : undefined,
                  )
                }
              >
                <Icon name="check" size={16} />
                Complete handover
              </button>
            )}
            {(stage === "accepted" || stage === "in_transit" || stage === "arrived") && (
              <button type="button" className="btn btn--ghost" onClick={() => void cancelJob()}>
                <Icon name="back" size={16} />
                Cancel job
              </button>
            )}
          </div>
        )}
      </div>

      {hintsOpen && (
        <div className="card">
          <div className="card__head">
            <h3>Handover flow</h3>
            <button type="button" className="btn btn--sm" onClick={() => setHintsOpen(false)}>
              Hide
            </button>
          </div>
          <div className="flow">
            <div className="flow__step">
              <span className="badge badge--lime">1</span>
              <p className="small">
                <strong>Depart</strong> to the pickup pin. The customer sees you moving live.
              </p>
            </div>
            <div className="flow__step">
              <span className="badge badge--lime">2</span>
              <p className="small">
                <strong>Arrive</strong>, then ask the motorist to read their 4-digit code out loud.
              </p>
            </div>
            <div className="flow__step">
              <span className="badge badge--lime">3</span>
              <p className="small">
                <strong>Enter the code</strong> — and scan the seal again for fuel — to complete the
                handover and release the payout.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
