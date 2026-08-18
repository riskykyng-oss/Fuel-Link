import { Icon } from "../icons";
import type { ServiceTileData } from "../types";
import { cn } from "../cn";

interface ServiceTileProps {
  tile: ServiceTileData;
  selected: boolean;
  onSelect: () => void;
}

/** One 2x2 service tile; only the selected tile is lime-filled. */
export function ServiceTile({ tile, selected, onSelect }: ServiceTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-[104px] flex-col items-start justify-between gap-2 rounded-tile border p-4 text-left transition-colors",
        selected
          ? "border-lime bg-lime text-lime-ink"
          : "border-border bg-surface text-text hover:bg-surface/70",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-control bg-base/20">
        <Icon name={tile.icon} size={18} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{tile.label}</span>
        <span className={cn("block text-xs", selected ? "text-lime-ink/70" : "text-muted")}>
          {tile.sublabel}
        </span>
      </span>
    </button>
  );
}

interface ServiceGridProps {
  tiles: ServiceTileData[];
  selected?: string;
  onSelect: (key: string) => void;
}

/** 2x2 motorist service grid. Renders nothing when empty. */
export function ServiceGrid({ tiles, selected, onSelect }: ServiceGridProps) {
  if (tiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => (
        <ServiceTile
          key={tile.key}
          tile={tile}
          selected={tile.key === selected}
          onSelect={() => onSelect(tile.key)}
        />
      ))}
    </div>
  );
}
