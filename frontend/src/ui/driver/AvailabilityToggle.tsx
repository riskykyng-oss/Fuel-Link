import { cn } from "../cn";

interface AvailabilityToggleProps {
  online: boolean;
  onToggle: () => void;
}

/** Driver on-duty switch. Online shows as an active (lime) state. */
export function AvailabilityToggle({ online, onToggle }: AvailabilityToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={online}
      onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-border bg-surface px-4"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className={cn("h-2 w-2 rounded-full", online ? "bg-lime" : "bg-muted")} />
        {online ? "On duty — accepting jobs" : "Off duty"}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          online ? "bg-lime" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-base transition-all",
            online ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
