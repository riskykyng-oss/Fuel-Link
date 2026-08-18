import type { ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cn } from "../cn";

interface CardProps {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Surface panel with optional title row and trailing action node. */
export function Card({ title, action, className, children }: CardProps) {
  return (
    <section className={cn("rounded-card border border-border bg-surface p-4", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h3 className="text-sm font-semibold text-text">{title}</h3> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface KpiCardProps {
  icon: IconName;
  label: string;
  value: string;
  linkLabel?: string;
  onLinkClick?: () => void;
}

/** Single metric tile; optional "View all"-style link row. */
export function KpiCard({ icon, label, value, linkLabel, onLinkClick }: KpiCardProps) {
  return (
    <div className="flex min-h-[104px] flex-col justify-between gap-2 rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon name={icon} size={16} />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-2xl font-semibold tabular-nums text-text">{value}</span>
      {linkLabel && onLinkClick && (
        <button
          type="button"
          onClick={onLinkClick}
          className="flex min-h-6 items-center gap-1 self-start text-xs font-medium text-lime-text hover:underline"
        >
          {linkLabel}
          <Icon name="chevron-right" size={14} />
        </button>
      )}
    </div>
  );
}
