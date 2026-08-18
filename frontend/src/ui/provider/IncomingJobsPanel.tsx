import { Button } from "../primitives/Button";
import { Card } from "../primitives/Card";
import { EmptyState } from "../primitives/EmptyState";
import { Money } from "../primitives/Button";
import type { JobRequestData } from "../types";

interface JobRequestCardProps {
  job: JobRequestData;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

/** One queued request. Accept is lime primary; Decline is always ghost. */
export function JobRequestCard({ job, onAccept, onDecline }: JobRequestCardProps) {
  return (
    <article className="rounded-tile border border-border bg-base p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{job.serviceType}</p>
          <p className="text-xs text-muted">{job.customerName}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
          {job.ageMinutes}m
        </span>
      </div>
      <p className="mt-2 text-sm">{job.summary}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
        <span>{job.address}</span>
        <span>·</span>
        <span>{job.distanceKm.toFixed(1)} km</span>
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-base font-semibold tabular-nums">
          <Money amountUsd={job.amountUsd} />
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onDecline(job.id)}>
            Decline
          </Button>
          <Button onClick={() => onAccept(job.id)}>Accept</Button>
        </div>
      </div>
    </article>
  );
}

interface IncomingJobsPanelProps {
  jobs: JobRequestData[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  unreadCount?: number;
}

/** Queue of incoming requests. Unread count uses the danger badge. */
export function IncomingJobsPanel({
  jobs,
  onAccept,
  onDecline,
  unreadCount = 0,
}: IncomingJobsPanelProps) {
  return (
    <Card
      title="Incoming jobs"
      action={
        unreadCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-base">
            {unreadCount}
          </span>
        ) : undefined
      }
    >
      {jobs.length === 0 ? (
        <EmptyState
          icon="grid"
          headline="No incoming jobs"
          body="New requests will appear here as they come in."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobRequestCard key={job.id} job={job} onAccept={onAccept} onDecline={onDecline} />
          ))}
        </div>
      )}
    </Card>
  );
}
