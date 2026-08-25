import { useEffect, useState } from "react";

import { Icon } from "../../components/brand";
import { MapView, type MapMarker } from "../../components/map";
import { Sheet } from "../../components/ui";
import { api, ApiError, trackOrder, type Order, type TrackingFrame } from "../../lib/api";
import { serviceName } from "../../lib/services";
import { useToast } from "../../state";
import { TrackProgress } from "./shared";
import { PaymentScreen } from "./payment";
import { DeliveredScreen } from "./delivered";

export function ActiveOrder({ order, onCleared, onBack }: { order: Order; onCleared: () => void; onBack?: () => void }) {
  const { notify } = useToast();
  const [current, setCurrent] = useState(order);
  const [frame, setFrame] = useState<TrackingFrame | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const settled =
    current.payment_status === "paid" ||
    current.payment_status === "awaiting_confirmation" ||
    current.payment_status === "held" ||
    current.payment_status === "created";

  useEffect(() => {
    api.paymentStatus(order.id).then((p) => {
      setCurrent((prev) => ({ ...prev, payment_status: p.status }));
    }).catch(() => {});
  }, [order.id]);

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
    if (frame.supplier_lat != null && frame.supplier_lng != null) {
      setTrail((prev) => {
        const last = prev[prev.length - 1];
        if (last && last[0] === frame.supplier_lat && last[1] === frame.supplier_lng) return prev;
        const next = [...prev, [frame.supplier_lat, frame.supplier_lng] as [number, number]];
        return next.length > 50 ? next.slice(-50) : next;
      });
    }
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

  async function share() {
    const text = `FuelLink — ${current.reference}: ${serviceName(current.service_type)} to ${current.pickup_address ?? "your pin"}. ETA ${frame?.eta_minutes ?? current.eta_minutes} min.`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(text).catch(() => undefined);
      notify("Trip details copied to clipboard.");
    }
  }

  if (!settled) {
    return <PaymentScreen order={current} onPaid={(o) => setCurrent(o)} onCancel={cancel} onBack={onBack} />;
  }

  if (current.status === "delivered") {
    return <DeliveredScreen order={current} onCleared={onCleared} onBack={onBack} />;
  }

  const supplierAt: [number, number] | null =
    current.supplier_lat != null && current.supplier_lng != null
      ? [current.supplier_lat, current.supplier_lng]
      : null;
  const pickup: [number, number] = [current.pickup_lat ?? 0, current.pickup_lng ?? 0];

  const markers: MapMarker[] = [
    { id: "pickup", lat: pickup[0], lng: pickup[1], kind: "pickup", glyph: "◎", label: "You" },
  ];
  if (supplierAt) {
    markers.push({
      id: "supplier",
      lat: supplierAt[0],
      lng: supplierAt[1],
      kind: "supplier",
      glyph: "",
      label: frame?.supplier_name ?? "Provider",
    });
  }

  const routePoints: [number, number][] = supplierAt ? [supplierAt, pickup] : [];
  const eta = frame?.eta_minutes ?? current.eta_minutes;

  const statusLabel =
    current.status === "pending" || current.status === "offered" || current.status === "bidding"
      ? "Finding a provider"
      : current.status === "arrived"
        ? "Your provider is here"
        : current.status === "in_transit"
          ? "On the way"
          : current.status === "accepted"
            ? "Provider assigned"
            : `${eta} min away`;

  return (
    <div className="screen" style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MapView
          center={supplierAt ?? pickup}
          markers={markers}
          route={routePoints.length >= 2 ? routePoints : null}
          trail={trail.length >= 2 ? trail : null}
          fitBounds={!!supplierAt}
        />
      </div>

      <button
        type="button"
        className="tracking-back"
        onClick={() => onBack?.()}
        aria-label="Go back"
      >
        <Icon name="back" size={18} />
      </button>

      <div className="tracking-eta">
        <div className="tracking-eta__ring">
          <span className="tracking-eta__number">{eta}</span>
          <span className="tracking-eta__unit">min</span>
        </div>
        <span className="tracking-eta__pulse" />
      </div>

      <div style={{ position: "relative", marginTop: "auto", zIndex: 400 }}>
        <Sheet>
          <div className="stack">
            <div className="between">
              <div>
                <p className="eyebrow">Order {current.reference}</p>
                <h2 style={{ marginTop: 4 }}>{statusLabel}</h2>
              </div>
              <span className="badge badge--ok">
                <Icon name="shield" size={12} />
                Tracked live
              </span>
            </div>

            <TrackProgress status={current.status} />

            {frame?.supplier_name && (
              <div className="provider">
                <span className="avatar avatar--ring-green" style={{ width: 46, height: 46 }}>
                  {frame.supplier_name.charAt(0).toUpperCase()}
                </span>
                <div className="grow">
                  <div className="between">
                    <strong style={{ fontSize: 14 }}>{frame.supplier_name}</strong>
                    <a className="btn btn--sm" href={`tel:${frame.supplier_phone ?? ""}`}>
                      <Icon name="phone" size={15} /> Call
                    </a>
                  </div>
                  {frame.provider_verified && <span className="badge badge--ok">Verified provider</span>}
                  <div className="row" style={{ gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    {frame.provider_staff_id && <span className="id-chip">Staff {frame.provider_staff_id}</span>}
                    {current.seal_id && (
                      <span className="id-chip">
                        <Icon name="seal" size={12} />
                        {current.seal_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {current.photo_url && (
              <img
                src={current.photo_url}
                alt="Breakdown photo"
                style={{
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--border)",
                }}
              />
            )}

            {current.status === "arrived" && (
              <div className="tile handover">
                <p className="eyebrow">Handover code — read it out</p>
                {current.handover_code && (
                  <div
                    className="handover__code"
                    style={{
                      fontSize: 40,
                      fontWeight: 700,
                      letterSpacing: "0.45em",
                      fontFamily: "var(--data)",
                      textAlign: "center",
                      color: "var(--acid)",
                      margin: "10px 0 2px",
                    }}
                    aria-label={`Handover code ${current.handover_code}`}
                  >
                    {current.handover_code}
                  </div>
                )}
                <p className="small muted">
                  Read this code out loud to your provider. They enter it on their side to
                  complete the job — you never type it.
                </p>
                <span className="handover__secure">
                  <Icon name="shield" size={13} />
                  At ZERA cap, verified today
                </span>
                <div className="ledger" style={{ width: "100%" }}>
                  <div className="ledger__line">
                    <span className="muted">
                      {current.quantity_litres > 0
                        ? `${current.quantity_litres.toFixed(0)} L ${current.fuel_type}`
                        : serviceName(current.service_type)}
                    </span>
                    <span className="data">${current.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="ledger__line ledger__line--total">
                    <span>Total</span>
                    <span className="data acid">${current.total_amount.toFixed(2)}</span>
                  </div>
                </div>
                <p className="small muted">
                  Funds are released to the provider only after the verified handover.
                </p>
              </div>
            )}

            <button type="button" className="btn btn--ghost btn--block" onClick={share}>
              <Icon name="share" size={16} />
              Share trip with a contact
            </button>

            {(current.status === "pending" || current.status === "offered" || current.status === "bidding") && (
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
