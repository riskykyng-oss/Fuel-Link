import { Card } from "../primitives/Card";
import { Icon } from "../icons";

interface SupportCardProps {
  phone: string;
  hours: string;
}

/** Support contact card; phone renders a tap-to-call link. */
export function SupportCard({ phone, hours }: SupportCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted">
          <Icon name="phone" size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Support</p>
          <p className="text-xs text-muted">{hours}</p>
        </div>
        <a
          href={`tel:${phone.replace(/\s+/g, "")}`}
          className="ml-auto flex min-h-11 items-center gap-2 rounded-control border border-border px-4 text-sm font-medium hover:bg-surface"
        >
          <Icon name="phone" size={16} />
          {phone}
        </a>
      </div>
    </Card>
  );
}
