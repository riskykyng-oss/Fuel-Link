import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { Icon, type IconName } from "./brand";
import type { Quote } from "../lib/api";

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {hint && <p className="small muted">{hint}</p>}
    </label>
  );
}

export function SelectField({
  label,
  options,
  ...props
}: {
  label: string;
  options: { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The signature element: a service-station price board. Each digit sits in its
 * own well and rolls when the number changes, the way a mechanical pump counter
 * does. Used anywhere money is quoted so the app has one consistent way of
 * saying "here is what this costs".
 */
export function PumpReadout({
  amount,
  caption,
  currency = "$",
}: {
  amount: number;
  caption: string;
  currency?: string;
}) {
  const characters = amount.toFixed(2).split("");
  return (
    <div className="readout">
      <p className="eyebrow">{caption}</p>
      <div className="readout__digits">
        <span className="digit digit--flat" style={{ fontSize: 20, marginRight: 4 }}>
          {currency}
        </span>
        {characters.map((char, index) =>
          char === "." ? (
            <span key={index} className="digit digit--flat">
              .
            </span>
          ) : (
            <span key={index} className="digit">
              <span key={char}>{char}</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function QuoteLedger({ quote, rate = 3 }: { quote: Quote; rate?: number }) {
  return (
    <div className="ledger">
      {quote.fuel_cost > 0 && (
        <div className="ledger__line">
          <span className="muted">
            Fuel · {(quote.fuel_cost / quote.unit_price).toFixed(0)} L @ $
            {quote.unit_price.toFixed(2)}
          </span>
          <span className="data">${quote.fuel_cost.toFixed(2)}</span>
        </div>
      )}
      <div className="ledger__line">
        <span className="muted">
          Delivery · {quote.distance_km.toFixed(2)} km × ${rate}
        </span>
        <span className="data">${quote.delivery_fee.toFixed(2)}</span>
      </div>
      {quote.service_fee > 0 && (
        <div className="ledger__line">
          <span className="muted">Callout</span>
          <span className="data">${quote.service_fee.toFixed(2)}</span>
        </div>
      )}
      <div className="ledger__line ledger__line--total">
        <span>Total</span>
        <span className="data acid">${quote.total_amount.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="sheet">
      <div className="sheet__grip" />
      {children}
    </div>
  );
}

export function TopBar({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="topbar">
      {onBack && (
        <button
          type="button"
          className="btn btn--sm"
          onClick={onBack}
          aria-label="Go back"
          style={{ padding: "0 10px" }}
        >
          <Icon name="back" size={18} />
        </button>
      )}
      <h3 className="grow">{title}</h3>
      {action}
    </header>
  );
}

const STATUS_STEPS: { key: string; label: string }[] = [
  { key: "pending", label: "Finding a supplier" },
  { key: "accepted", label: "Supplier assigned" },
  { key: "in_transit", label: "On the way" },
  { key: "arrived", label: "Arrived at your pin" },
  { key: "delivered", label: "Completed" },
];

export function StatusTimeline({ status }: { status: string }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="timeline">
      {STATUS_STEPS.map((step, index) => (
        <div
          key={step.key}
          className="timeline__step"
          data-done={index <= currentIndex ? "true" : "false"}
        >
          <div className="timeline__rail">
            <div className="timeline__node" />
            {index < STATUS_STEPS.length - 1 && <div className="timeline__line" />}
          </div>
          <p
            style={{ paddingBottom: 14 }}
            className={index <= currentIndex ? undefined : "muted"}
          >
            {step.label}
          </p>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="muted">
        <Icon name={icon} size={30} />
      </span>
      <h3>{title}</h3>
      <p className="muted small">{body}</p>
      {action}
    </div>
  );
}
