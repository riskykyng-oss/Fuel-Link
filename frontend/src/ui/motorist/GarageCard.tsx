import { Icon } from "../icons";
import { VerifiedBadge } from "../primitives/StatusPill";
import type { GarageData } from "../types";

interface GarageCardProps {
  garage: GarageData;
  onRequest: (id: string) => void;
}

/** Nearest garage/mechanic with service chips and a lime primary request action. */
export function GarageCard({ garage, onRequest }: GarageCardProps) {
  return (
    <article className="rounded-tile border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base text-muted">
          <Icon name="wrench" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{garage.name}</p>
            {garage.verified && <VerifiedBadge label="Verified" />}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Icon name="route" size={12} />
              {garage.distanceKm.toFixed(1)} km
            </span>
            <span className="flex items-center gap-1">
              <Icon name="star" size={12} />
              {garage.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="clock" size={12} />
              ~{garage.etaMinutes} min
            </span>
          </p>
        </div>
      </div>

      {garage.services.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {garage.services.map((service) => (
            <span
              key={service}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted"
            >
              {service}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onRequest(garage.id)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-lime text-sm font-semibold text-lime-ink hover:bg-lime/90"
      >
        <Icon name="wrench" size={16} />
        Request help
      </button>
    </article>
  );
}
