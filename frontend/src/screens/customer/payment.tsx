import { useEffect, useState } from "react";

import { Icon } from "../../components/brand";
import { Field, PumpReadout, TopBar } from "../../components/ui";
import { api, ApiError, type Order, type PaymentMethod } from "../../lib/api";
import { useSession, useToast } from "../../state";

export function PaymentScreen({
  order,
  onPaid,
  onCancel,
  onBack,
}: {
  order: Order;
  onPaid: (order: Order) => void;
  onCancel: () => void;
  onBack?: () => void;
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
      <TopBar title="Pay to dispatch" onBack={onBack} />
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
                  background: "var(--surface-2)",
                  flex: "none",
                }}
              >
                <Icon name="phone" size={20} />
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
              selected.prefixes.length ? `Accepts ${selected.prefixes.join(", ")} numbers.` : undefined
            }
          />
        )}

        {instructions && <div className="tile small">{instructions}</div>}

        <span className="badge badge--ok" style={{ alignSelf: "center" }}>
          <Icon name="shield" size={12} />
          Secure payment
        </span>

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
