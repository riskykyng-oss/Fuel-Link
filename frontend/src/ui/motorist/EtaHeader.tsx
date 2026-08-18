import { Icon } from "../icons";
import { Card } from "../primitives/Card";
import { VerifiedBadge } from "../primitives/StatusPill";

interface EtaHeaderProps {
  etaMinutes: number;
  distanceKm: number;
}

/** Big ETA readout at the top of an active trip. */
export function EtaHeader({ etaMinutes, distanceKm }: EtaHeaderProps) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-lime-ink">
        <Icon name="clock" size={22} />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums">
          {etaMinutes} min
        </p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <Icon name="route" size={13} />
          {distanceKm.toFixed(1)} km away
        </p>
      </div>
    </div>
  );
}

interface CourierCardProps {
  name: string;
  verified: boolean;
  stationStaffId: string;
  sealedContainerId: string;
  onCall: () => void;
}

/** The assigned courier with staff/container IDs and call action. */
export function CourierCard({
  name,
  verified,
  stationStaffId,
  sealedContainerId,
  onCall,
}: CourierCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-sm font-semibold text-lime-ink">
          {name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{name}</p>
            {verified && <VerifiedBadge label="Verified" />}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Staff ID {stationStaffId} · Container {sealedContainerId}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCall}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-lime text-sm font-semibold text-lime-ink hover:bg-lime/90"
      >
        <Icon name="phone" size={16} />
        Call courier
      </button>
    </Card>
  );
}
