import type { IconName } from "../components/brand";
import type { ServiceType } from "./api";

/** Central Harare pin used when GPS is unavailable. */
export const HARARE: [number, number] = [-17.8252, 31.0335];

/** National roadside emergency line. */
export const EMERGENCY_LINE = "+263242700000";

/** Icon + human label per service. Shared by motorist and garage apps. */
export const SERVICE_INFO: Record<string, { icon: IconName; label: string }> = {
  fuel: { icon: "nozzle", label: "Fuel delivery" },
  towing: { icon: "tow", label: "Towing" },
  jump_start: { icon: "battery", label: "Jump start" },
  tyre_change: { icon: "tyre", label: "Tyre change" },
  lockout: { icon: "key", label: "Lockout" },
  mechanic: { icon: "wrench", label: "Roadside mechanic" },
  other: { icon: "wrench", label: "Roadside help" },
};

export function serviceIcon(id: string): IconName {
  return SERVICE_INFO[id]?.icon ?? "wrench";
}

export function serviceLabel(id: string): string {
  return SERVICE_INFO[id]?.label ?? id.replace("_", " ");
}

export const serviceName = serviceLabel;

/** Full catalogue used by the garage "Services offered" manager. */
export const SERVICE_CATALOGUE: {
  id: ServiceType;
  label: string;
  icon: IconName;
  fee: number;
}[] = [
  { id: "fuel", label: "Fuel delivery", icon: "nozzle", fee: 0 },
  { id: "towing", label: "Towing", icon: "tow", fee: 25 },
  { id: "jump_start", label: "Jump start", icon: "battery", fee: 8 },
  { id: "tyre_change", label: "Tyre change", icon: "tyre", fee: 10 },
  { id: "lockout", label: "Lockout assistance", icon: "key", fee: 12 },
  { id: "mechanic", label: "Roadside mechanic", icon: "wrench", fee: 15 },
];

/** Time-of-day greeting for dashboards. */
export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
