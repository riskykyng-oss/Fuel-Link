import { Icon } from "../icons";
import { Money } from "../primitives/Button";
import type { DriverJobData } from "../types";

interface ActiveJobCardProps {
  job: DriverJobData;
  onCall: () => void;
}

/** The job a driver is currently assigned to. */
export function ActiveJobCard({ job, onCall }: ActiveJobCardProps) {
  return (
    <article className="rounded-tile border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{job.serviceType}</p>
        <span className="text-xs text-muted">{job.id}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base text-muted">
          <Icon name="user" size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{job.customerName}</p>
          <p className="truncate text-xs text-muted">{job.address}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Icon name="route" size={12} />
          {job.distanceKm.toFixed(1)} km
        </span>
        <span className="flex items-center gap-1">
          <Icon name="clock" size={12} />
          ~{job.etaMinutes} min
        </span>
        <span className="ml-auto font-medium text-text">
          Payout <Money amountUsd={job.payoutUsd} />
        </span>
      </div>
      <button
        type="button"
        onClick={onCall}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border px-4 text-sm font-medium text-text hover:bg-base"
      >
        <Icon name="phone" size={16} />
        Call motorist
      </button>
    </article>
  );
}
