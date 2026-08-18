import { Card } from "../primitives/Card";
import { Money } from "../primitives/Button";
import { Icon } from "../icons";

interface EarningsSummaryProps {
  todayUsd: number;
  deltaPct: number;
  completedCount: number;
  responseRatePct: number;
}

/** Today's earnings with delta and secondary stats. */
export function EarningsSummary({
  todayUsd,
  deltaPct,
  completedCount,
  responseRatePct,
}: EarningsSummaryProps) {
  const up = deltaPct >= 0;
  return (
    <Card>
      <p className="text-sm font-semibold">Earnings today</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-3xl font-semibold tabular-nums">
          <Money amountUsd={todayUsd} />
        </span>
        <span
          className={
            up
              ? "mb-1 flex items-center gap-1 text-xs font-medium text-success"
              : "mb-1 flex items-center gap-1 text-xs font-medium text-muted"
          }
        >
          <Icon name={up ? "arrow-up" : "arrow-down"} size={14} />
          {Math.abs(deltaPct).toFixed(0)}%
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <div>
          <dt className="text-xs text-muted">Jobs completed</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{completedCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Response rate</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{responseRatePct}%</dd>
        </div>
      </dl>
    </Card>
  );
}
