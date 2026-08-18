import { cn } from "../cn";

interface StockBarProps {
  label: string;
  litres: number;
  capacityLitres: number;
}

/** Fuel-level bar for one grade. Clamps to capacity; empty-safe. */
export function StockBar({ label, litres, capacityLitres }: StockBarProps) {
  const pct = capacityLitres > 0 ? Math.max(0, Math.min(1, litres / capacityLitres)) : 0;
  const low = pct <= 0.2;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text">{label}</span>
        <span className={cn("text-xs tabular-nums", low ? "text-warn" : "text-muted")}>
          {litres.toLocaleString()} L
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-base">
        <div
          className={cn("h-full rounded-full", low ? "bg-warn" : "bg-lime")}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
