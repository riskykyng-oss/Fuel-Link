import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Icon, Loader } from "../../components/brand";
import { TopBar } from "../../components/ui";
import {
  api,
  type Dispute,
  type Order,
  type SupplierSummary,
} from "../../lib/api";
import { serviceIcon, serviceLabel } from "../../lib/services";
import { useSession } from "../../state";
import { POLL_MS } from "./useSupplier";

export function SupplierJobs() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refresh();
    const load = () =>
      Promise.all([api.supplierSummary(), api.orders(), api.disputes()])
        .then(([s, o, d]) => {
          setSummary(s);
          setOrders(o);
          setDisputes(d);
        })
        .finally(() => setLoading(false));
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function reply(dispute: Dispute) {
    const body = (drafts[dispute.id] ?? "").trim();
    if (!body || busy === dispute.id) return;
    setBusy(dispute.id);
    try {
      const updated = await api.replyToDispute(dispute.id, body);
      setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setDrafts((prev) => ({ ...prev, [dispute.id]: "" }));
    } finally {
      setBusy(null);
    }
  }

  async function resolve(dispute: Dispute) {
    if (busy === dispute.id) return;
    setBusy(dispute.id);
    try {
      const updated = await api.setDisputeStatus(dispute.id, "resolved");
      setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="screen">
      <TopBar title="Earnings & payouts" onBack={() => navigate("/")} />
      <div className="pad stack">
        {loading || !summary ? (
          <Loader label="Loading earnings" />
        ) : (
          <>
            <div className="grid-2">
              <div className="tile">
                <p className="eyebrow">Released to you</p>
                <p className="data acid" style={{ fontSize: 26, fontWeight: 600 }}>
                  ${summary.payout_released.toFixed(2)}
                </p>
                <p className="small muted">verified handovers, settled</p>
              </div>
              <div className="tile">
                <p className="eyebrow">Held in escrow</p>
                <p className="data" style={{ fontSize: 26, fontWeight: 600 }}>
                  ${summary.payout_held.toFixed(2)}
                </p>
                <p className="small muted">awaiting settlement</p>
              </div>
            </div>

            <div className="grid-2">
              <div className="tile">
                <p className="eyebrow">Disputed</p>
                <p className="data" style={{ fontSize: 22, fontWeight: 600 }}>
                  ${summary.payout_disputed.toFixed(2)}
                </p>
                <p className="small muted">{summary.disputes_open} open dispute{summary.disputes_open === 1 ? "" : "s"}</p>
              </div>
              <div className="tile">
                <p className="eyebrow">Lifetime</p>
                <p className="data" style={{ fontSize: 22, fontWeight: 600 }}>
                  ${summary.total_earnings.toFixed(2)}
                </p>
                <p className="small muted">${summary.earnings_today.toFixed(2)} today · {summary.rating.toFixed(1)}★</p>
              </div>
            </div>

            <div className="tile">
              <p className="eyebrow">Payout flow</p>
              <p className="small muted" style={{ marginTop: 4 }}>
                Funds move to released only after a verified handover. You keep delivery + callout
                fees; the fuel cost settles against the ZERA cap. Any job you disagree with opens a
                dispute below before settlement.
              </p>
            </div>
          </>
        )}

        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Disputes
          </p>
          {disputes.length === 0 ? (
            <div className="tile">
              <p className="small muted">
                <Icon name="shield" size={13} /> No disputes on your jobs.
              </p>
            </div>
          ) : (
            disputes.map((d) => (
              <div key={d.id} className="tile stack" style={{ gap: 8 }}>
                <div className="between">
                  <strong className="data small">
                    {d.reference ?? `Order #${d.order_id}`}
                  </strong>
                  <span className={`badge ${d.status === "open" ? "badge--lime" : "badge--ok"}`}>
                    {d.status}
                  </span>
                </div>
                <p className="small">{d.reason}</p>
                {d.messages.slice(1).map((m) => (
                  <p key={m.id} className="small muted">
                    {m.sender_role === "supplier" ? "You: " : "Motorist: "}
                    {m.body}
                  </p>
                ))}
                {d.status === "open" && (
                  <>
                    <div className="row" style={{ gap: 6 }}>
                      <input
                        className="input"
                        placeholder="Reply to this dispute…"
                        value={drafts[d.id] ?? ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void reply(d);
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn--sm"
                        disabled={busy === d.id}
                        onClick={() => void reply(d)}
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--ok"
                        disabled={busy === d.id}
                        onClick={() => void resolve(d)}
                      >
                        Resolve
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Job history
          </p>
          {orders.map((o) => (
            <div key={o.id} className="tile stack" style={{ gap: 8 }}>
              <div className="between">
                <span className="row" style={{ gap: 8 }}>
                  <span
                    className={`dot ${o.status === "delivered" ? "dot--live" : o.status === "cancelled" ? "dot--off" : "dot--warn"}`}
                  />
                  <strong className="data small">{o.reference}</strong>
                </span>
                <span className="data acid">${(o.delivery_fee + o.service_fee).toFixed(2)}</span>
              </div>
              <p className="small">
                <Icon name={serviceIcon(o.service_type)} size={14} />
                <span style={{ marginLeft: 6 }}>
                  {o.service_type === "fuel"
                    ? `${o.quantity_litres.toFixed(0)} L ${o.fuel_type}`
                    : serviceLabel(o.service_type)}
                </span>
                {" · "}
                {o.customer.full_name}
              </p>
              <p className="small muted">
                {new Date(o.created_at).toLocaleString()} · {o.status.replace("_", " ")}
                {o.rating ? ` · ${o.rating}★` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
