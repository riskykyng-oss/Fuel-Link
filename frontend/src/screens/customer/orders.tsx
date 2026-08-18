import { useEffect, useMemo, useState } from "react";

import { Icon, Loader } from "../../components/brand";
import { EmptyState, Segmented, TopBar } from "../../components/ui";
import { api, type Order, type PaymentMethod } from "../../lib/api";
import { serviceName } from "../../lib/services";

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [tab, setTab] = useState<"active" | "completed" | "cancelled">("active");

  useEffect(() => {
    api.paymentMethods().then(setMethods).catch(() => setMethods([]));
    api.orders().then(setOrders).catch(() => setOrders([]));
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (tab === "active")
      return orders.filter((o) => !["delivered", "cancelled", "declined"].includes(o.status));
    if (tab === "completed") return orders.filter((o) => o.status === "delivered");
    return orders.filter((o) => o.status === "cancelled" || o.status === "declined");
  }, [orders, tab]);

  if (!orders) return <Loader label="Loading your trips" />;

  return (
    <div className="screen">
      <TopBar title="Orders" />
      <div className="pad stack">
        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Payment methods
          </p>
          <div className="method-list">
            {methods.map((m) => (
              <span key={m.id} className="chip chip--static">
                <Icon name="phone" size={14} />
                {m.name}
              </span>
            ))}
          </div>
        </div>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon="clock"
            title={`No ${tab} trips`}
            body="Your roadside requests and deliveries will show up here."
          />
        ) : (
          filtered.map((o) => (
            <div key={o.id} className="tile stack" style={{ gap: 8 }}>
              <div className="between">
                <span className="row" style={{ gap: 8 }}>
                  <span
                    className={`dot ${o.status === "delivered" ? "dot--live" : o.status === "cancelled" || o.status === "declined" ? "dot--off" : "dot--warn"}`}
                  />
                  <strong className="data small">{o.reference}</strong>
                </span>
                <span className="data acid">${o.total_amount.toFixed(2)}</span>
              </div>
              <p className="small">
                {o.service_type === "fuel"
                  ? `${o.quantity_litres.toFixed(0)} L ${o.fuel_type}`
                  : serviceName(o.service_type)}{" "}
                · {o.pickup_address ?? "No provider available"}
              </p>
              {o.photo_url && (
                <img
                  src={o.photo_url}
                  alt="Attached"
                  style={{
                    width: "100%",
                    height: 110,
                    objectFit: "cover",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--border)",
                  }}
                />
              )}
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
