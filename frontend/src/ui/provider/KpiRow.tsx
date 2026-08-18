import { KpiCard } from "../primitives/Card";
import type { IconName } from "../icons";

export interface KpiItem {
  icon: IconName;
  label: string;
  value: string;
  linkLabel?: string;
  onLinkClick?: () => void;
}

interface KpiRowProps {
  items: KpiItem[];
}

/** Responsive row of five metric tiles. Renders nothing when empty. */
export function KpiRow({ items }: KpiRowProps) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <KpiCard
          key={item.label}
          icon={item.icon}
          label={item.label}
          value={item.value}
          linkLabel={item.linkLabel}
          onLinkClick={item.onLinkClick}
        />
      ))}
    </div>
  );
}
