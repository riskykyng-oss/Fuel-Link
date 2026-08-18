import { Icon } from "../icons";
import type { PillStatus } from "../types";
import { cn } from "../cn";

const PILL_STYLE: Record<PillStatus, { dot: string; text: string; label: string }> = {
  completed: { dot: "bg-success", text: "text-success", label: "Completed" },
  en_route: { dot: "bg-blue", text: "text-blue", label: "En route" },
  accepted: { dot: "bg-lime", text: "text-lime-text", label: "Accepted" },
  declined: { dot: "bg-muted", text: "text-muted", label: "Declined" },
};

interface StatusPillProps {
  status: PillStatus;
}

/** Job status pill used in queues and tables. Success/blue/lime/muted only. */
export function StatusPill({ status }: StatusPillProps) {
  const style = PILL_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium",
        style.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

interface VerifiedBadgeProps {
  label: string;
  verifiedAt?: string;
}

/** Compliance / verification marker. Success-coloured only. */
export function VerifiedBadge({ label, verifiedAt }: VerifiedBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
      <Icon name="shield" size={14} />
      {label}
      {verifiedAt && <span className="opacity-70">· {verifiedAt}</span>}
    </span>
  );
}
