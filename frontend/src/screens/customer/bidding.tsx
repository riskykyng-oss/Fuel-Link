import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "../../components/brand";
import { api, ApiError, type Bid, type Order } from "../../lib/api";
import { serviceName } from "../../lib/services";
import { useToast } from "../../state";
import { PaymentScreen } from "./payment";
import { DeliveredScreen } from "./delivered";

function timeSince(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

/**
 * Customer's view when order is in BIDDING status.
 * Shows request details + incoming bids from suppliers.
 * Polls every 3s for new bids.
 */
export function BiddingScreen({
  order,
  onCleared,
  onBack,
}: {
  order: Order;
  onCleared: () => void;
  onBack?: () => void;
}) {
  const { notify } = useToast();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [current, setCurrent] = useState(order);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBids = useCallback(() => {
    api
      .listBids(order.id)
      .then(setBids)
      .catch(() => {});
  }, [order.id]);

  useEffect(() => {
    loadBids();
    pollRef.current = setInterval(loadBids, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadBids]);

  // If the order moved past bidding (accepted, etc.), stop polling
  useEffect(() => {
    if (current.status !== "bidding" && pollRef.current) {
      clearInterval(pollRef.current);
    }
  }, [current.status]);

  useEffect(() => {
    setLoading(false);
  }, []);

  async function acceptBid(bid: Bid) {
    setAccepting(bid.id);
    try {
      const updated = await api.acceptBid(order.id, bid.id);
      setCurrent(updated);
      notify(`Bid accepted! ${bid.supplier_name ?? "The provider"} is on the way.`);
      if (pollRef.current) clearInterval(pollRef.current);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not accept the bid.", "error");
    } finally {
      setAccepting(null);
    }
  }

  // Once payment is settled and order moves to active, transition out
  if (current.status !== "bidding") {
    if (current.status === "delivered") {
      return <DeliveredScreen order={current} onCleared={onCleared} onBack={onBack} />;
    }
    if (current.payment_status === "paid" || current.payment_status === "held" || current.payment_status === "awaiting_confirmation" || current.payment_status === "created") {
      return null; // Parent (home.tsx) will pick up active order via polling
    }
    // If accepted but not paid, show payment
    if (current.status === "accepted" && current.payment_status !== "paid") {
      return (
        <PaymentScreen
          order={current}
          onPaid={(o) => { setCurrent(o); }}
          onCancel={async () => {
            try { await api.setOrderStatus(current.id, "cancelled"); notify("Request cancelled."); onCleared(); }
            catch (e) { notify(e instanceof ApiError ? e.message : "Could not cancel.", "error"); }
          }}
          onBack={() => { setCurrent({ ...current, status: "bidding" }); }}
        />
      );
    }
    // Otherwise the order is active - let the parent's activeOrder polling handle it
    return null;
  }

  const service = current.service_type;
  const isFuel = service === "fuel";

  return (
    <div className="screen" style={{ position: "relative" }}>
      <div className="pad stack" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <div className="between" style={{ marginBottom: 8 }}>
          <div>
            <p className="eyebrow">Waiting for suppliers</p>
            <h1 style={{ marginTop: 4 }}>
              {isFuel
                ? `${current.quantity_litres} L ${current.fuel_type}`
                : serviceName(service)}
            </h1>
          </div>
          <button type="button" className="btn btn--sm" onClick={onBack}>
            <Icon name="back" size={15} /> Edit
          </button>
        </div>

        <div className="tile">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="chip chip--static">
              <Icon name="target" size={13} /> {current.pickup_address ?? "Your pin"}
            </span>
            <span className="chip chip--static">
              <Icon name="route" size={13} /> {current.distance_km.toFixed(1)} km
            </span>
            {current.eta_minutes > 0 && (
              <span className="chip chip--static">
                <Icon name="clock" size={13} /> ~{current.eta_minutes} min
              </span>
            )}
          </div>
          {current.notes && (
            <p className="small muted" style={{ marginTop: 8 }}>"{current.notes}"</p>
          )}
        </div>

        <div className="tile" style={{ background: "var(--surface-2)" }}>
          <div className="between">
            <p className="eyebrow">Your offer</p>
            <span className="data acid" style={{ fontSize: 22 }}>${current.total_amount.toFixed(2)}</span>
          </div>
          <p className="small muted">
            Suppliers will propose their price. You pick the one you like.
          </p>
        </div>

        {loading ? (
          <div className="empty" style={{ padding: 20 }}>
            <span className="spinner" />
            <p className="muted small">Looking for bids...</p>
          </div>
        ) : bids.length === 0 ? (
          <div className="empty" style={{ padding: 32 }}>
            <span className="muted">
              <Icon name="clock" size={32} />
            </span>
            <h3>No bids yet</h3>
            <p className="muted small">
              Suppliers are seeing your request and preparing their offers.
              This usually takes less than a minute.
            </p>
            <p className="muted small">
              <span className="dot dot--live" style={{ marginRight: 6 }} />
              Searching nearby providers...
            </p>
          </div>
        ) : (
          <>
            <p className="eyebrow">{bids.length} bid{bids.length !== 1 ? "s" : ""} received</p>
            {bids.map((bid) => (
              <div key={bid.id} className="card" style={{ border: "1px solid var(--border)" }}>
                <div className="between">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="avatar avatar--ring-green" style={{ width: 42, height: 42 }}>
                      {(bid.supplier_company ?? bid.supplier_name ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div className="between">
                        <strong style={{ fontSize: 14 }}>{bid.supplier_company ?? bid.supplier_name}</strong>
                        {bid.supplier_verified && (
                          <span className="badge badge--ok" style={{ marginLeft: 6 }}>
                            <Icon name="shield" size={10} /> Verified
                          </span>
                        )}
                      </div>
                      <p className="small muted">
                        {bid.distance_km.toFixed(1)} km away
                        {bid.supplier_rating != null && bid.supplier_rating > 0
                          ? ` · ★ ${bid.supplier_rating.toFixed(1)}`
                          : ""}
                        {" · "}{timeSince(bid.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="line" style={{ margin: "10px 0" }} />

                <div className="between" style={{ alignItems: "center" }}>
                  <div>
                    <p className="eyebrow">Their price</p>
                    <p className="data acid" style={{ fontSize: 24 }}>
                      ${bid.proposed_amount.toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={accepting !== null}
                    onClick={() => void acceptBid(bid)}
                  >
                    {accepting === bid.id ? (
                      <span className="spinner" />
                    ) : (
                      <>
                        <Icon name="check" size={16} /> Accept
                      </>
                    )}
                  </button>
                </div>
                {bid.note && (
                  <p className="small muted" style={{ marginTop: 8 }}>
                    "{bid.note}"
                  </p>
                )}
              </div>
            ))}
          </>
        )}

        <button type="button" className="btn btn--ghost btn--block" onClick={() => void api.setOrderStatus(current.id, "cancelled").then(() => { notify("Request cancelled."); onCleared(); }).catch((e) => notify(e instanceof ApiError ? e.message : "Could not cancel.", "error"))}>
          <Icon name="back" size={16} /> Cancel request
        </button>
      </div>
    </div>
  );
}
