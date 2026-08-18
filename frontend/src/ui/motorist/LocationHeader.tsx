import { Icon } from "../icons";

interface LocationHeaderProps {
  address: string;
  onEdit: () => void;
  fixAgeSeconds: number;
}

/** Current pickup/delivery address with edit action and GPS freshness. */
export function LocationHeader({ address, onEdit, fixAgeSeconds }: LocationHeaderProps) {
  const stale = fixAgeSeconds > 30;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-lime-text">
        <Icon name="pin" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{address}</p>
        <p className={stale ? "text-xs text-warn" : "text-xs text-muted"}>
          {stale
            ? "Stale location — using last known"
            : `Updated ${fixAgeSeconds}s ago`}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit address"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-surface"
      >
        <Icon name="pencil" size={18} />
      </button>
    </div>
  );
}
