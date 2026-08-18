import { Icon } from "../icons";

interface StepHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

/** Back header for drill-down steps in the motorist flow. */
export function StepHeader({ title, subtitle, onBack }: StepHeaderProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-surface"
      >
        <Icon name="chevron-right" size={18} className="rotate-180" />
      </button>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
