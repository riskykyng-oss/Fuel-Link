import { Icon } from "../icons";
import { cn } from "../cn";

interface ProgressStepperProps {
  steps: string[];
  currentIndex: number;
}

/** Horizontal step dots for the handover flow. Renders nothing when empty. */
export function ProgressStepper({ steps, currentIndex }: ProgressStepperProps) {
  if (steps.length === 0) return null;
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "border-lime bg-lime text-lime-ink",
                active && "border-lime-text bg-base text-lime-text",
                !done && !active && "border-border bg-base text-muted",
              )}
            >
              {done ? <Icon name="check" size={13} strokeWidth={2.4} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[11px]",
                active ? "font-medium text-text" : "text-muted",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
