import { Icon } from "../icons";
import { VerifiedBadge } from "../primitives/StatusPill";

interface TopBarProps {
  greeting: string;
  subline: string;
  weather: { label: string; tempC: number };
  unreadCount: number;
  account: { name: string; initials: string };
}

/** Dashboard header row. Unread bell badge is the only danger marker here. */
export function TopBar({ greeting, subline, weather, unreadCount, account }: TopBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
      <div>
        <h1 className="text-lg font-semibold">{greeting}</h1>
        <p className="text-sm text-muted">{subline}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-sm text-muted sm:flex">
          <Icon name="sun" size={16} />
          {weather.label} {weather.tempC}°C
        </span>
        <button
          type="button"
          aria-label={`Notifications, ${unreadCount} unread`}
          className="relative flex h-11 w-11 items-center justify-center rounded-control border border-border text-muted hover:bg-surface"
        >
          <Icon name="bell" size={18} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-base">
              {unreadCount}
            </span>
          )}
        </button>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-lime text-sm font-semibold text-lime-ink"
          title={account.name}
        >
          {account.initials}
        </span>
      </div>
    </div>
  );
}

interface ProviderIdentityCardProps {
  name: string;
  address: string;
  verified: boolean;
}

/** Station identity + verification status on the dashboard. */
export function ProviderIdentityCard({ name, address, verified }: ProviderIdentityCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border text-muted">
        <Icon name="bolt" size={20} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          {verified && <VerifiedBadge label="Verified" />}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">{address}</p>
      </div>
    </div>
  );
}
