import type { ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";

interface EmptyStateProps {
  icon: IconName;
  headline: string;
  body?: string;
  action?: ReactNode;
}

/** Centred empty placeholder. Rendered whenever a list has no rows. */
export function EmptyState({ icon, headline, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-sm font-medium text-text">{headline}</p>
      {body && <p className="max-w-[240px] text-xs text-muted">{body}</p>}
      {action}
    </div>
  );
}
