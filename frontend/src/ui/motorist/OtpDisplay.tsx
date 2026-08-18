import { Card } from "../primitives/Card";
import { Money } from "../primitives/Button";
import type { OrderLineItemData } from "../types";

interface OtpDisplayProps {
  code: string;
}

/** Read-only 4-digit handover code; digits are lime tiles. */
export function OtpDisplay({ code }: OtpDisplayProps) {
  const digits = code.slice(0, 4).padEnd(4, "\u00b7").split("");
  return (
    <div className="flex justify-center gap-3" role="img" aria-label={`Handover code ${code}`}>
      {digits.map((digit, i) => (
        <span
          key={i}
          className="flex h-14 w-14 items-center justify-center rounded-tile bg-lime text-2xl font-bold text-lime-ink tabular-nums"
        >
          {digit}
        </span>
      ))}
    </div>
  );
}

interface OrderSummaryCardProps {
  lineItems: OrderLineItemData[];
  totalUsd: number;
}

/** Itemised order summary (fuel and delivery listed separately). */
export function OrderSummaryCard({ lineItems, totalUsd }: OrderSummaryCardProps) {
  return (
    <Card title="Order summary">
      {lineItems.length === 0 ? (
        <p className="text-sm text-muted">No items yet.</p>
      ) : (
        <dl className="flex flex-col gap-2">
          {lineItems.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="text-text">{item.label}</dt>
              <dd className="font-medium tabular-nums text-muted">
                <Money amountUsd={item.amountUsd} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-xl font-semibold tabular-nums">
          <Money amountUsd={totalUsd} />
        </span>
      </div>
    </Card>
  );
}
