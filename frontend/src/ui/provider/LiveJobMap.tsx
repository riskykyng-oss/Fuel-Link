import { Card } from "../primitives/Card";
import { MapCanvas } from "../primitives/MapCanvas";
import type { MapLegendItem, MapMarker } from "../types";
import { cn } from "../cn";

export const HARARE_CENTER: [number, number] = [-17.8292, 31.0522];

const LEGEND: MapLegendItem[] = [
  { key: "incoming", label: "Incoming", color: "lime" },
  { key: "accepted", label: "Accepted", color: "success" },
  { key: "en_route", label: "En route", color: "blue" },
  { key: "completed", label: "Completed", color: "muted" },
  { key: "high_demand", label: "High demand", color: "warn" },
];

interface LiveJobMapProps {
  jobs: MapMarker[];
  center?: [number, number];
}

/** Live jobs map with status legend. `center` must be a stable reference. */
export function LiveJobMap({ jobs, center = HARARE_CENTER }: LiveJobMapProps) {
  return (
    <Card title="Live jobs">
      <MapCanvas markers={jobs} center={center} height={360} />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {LEGEND.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span className={cn("h-2 w-2 rounded-full", `ui-pin--${item.color}`)} />
            {item.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
