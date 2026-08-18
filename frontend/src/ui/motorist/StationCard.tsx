import { Icon } from "../icons";
import { Money } from "../primitives/Button";
import { VerifiedBadge } from "../primitives/StatusPill";
import { cn } from "../cn";
import type { StationData } from "../types";

interface StationCardProps {
  station: StationData;
  onRequest: (id: string) => void;
}

/** Nearby gas station with live grades and a lime primary request action. */
export function StationCard({ station, onRequest }: StationCardProps) {
  return (
    <article className="rounded-tile border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base text-muted">
          <Icon name="nozzle" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{station.name}</p>
            {station.verified && <VerifiedBadge label="Verified" />}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Icon name="route" size={12} />
              {station.distanceKm.toFixed(1)} km
            </span>
            <span className="flex items-center gap-1">
              <Icon name="star" size={12} />
              {station.rating.toFixed(1)}
            </span>
            <span className={cn(!station.openNow && "text-warn")}>
              {station.openNow ? "Open now" : "Closed"}
            </span>
          </p>
        </div>
      </div>

      <dl className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
        {station.grades.map((grade) => (
          <div key={grade.label} className="flex items-center justify-between gap-3 text-sm">
            <dt className={cn("flex items-center gap-2", !grade.available && "text-muted")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", grade.available ? "bg-muted" : "bg-muted/40")} />
              {grade.label}
              {!grade.available && <span className="text-[11px]">out of stock</span>}
            </dt>
            <dd className={cn("font-medium tabular-nums", grade.available ? "text-text" : "text-muted")}>
              {grade.available ? (
                <>
                  <Money amountUsd={grade.priceUsdPerLitre} />/L
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={() => onRequest(station.id)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-lime text-sm font-semibold text-lime-ink hover:bg-lime/90"
      >
        <Icon name="nozzle" size={16} />
        Request delivery
      </button>
    </article>
  );
}
