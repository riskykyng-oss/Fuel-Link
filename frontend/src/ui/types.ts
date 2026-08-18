import type { IconName } from "./icons";

/** Statuses shown in StatusPill and the recent-jobs table. */
export type PillStatus = "completed" | "en_route" | "accepted" | "declined";

/** Pin fill colours on the map. Muted/blue/lime/success/warn only. */
export type PinTone = "lime" | "success" | "blue" | "muted" | "warn";

export interface MapLegendItem {
  key: string;
  label: string;
  color: PinTone;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  tone: PinTone;
  label?: string;
}

/** One tile in the motorist 2x2 service grid. */
export interface ServiceTileData {
  key: string;
  icon: IconName;
  label: string;
  sublabel: string;
}

/** One incoming request in the provider queue. */
export interface JobRequestData {
  id: string;
  serviceType: string;
  customerName: string;
  address: string;
  distanceKm: number;
  ageMinutes: number;
  summary: string;
  amountUsd: number;
}

/** One fuel grade on the stock card. */
export interface StockGradeData {
  label: string;
  litres: number;
  capacityLitres: number;
  avgPrice: number;
}

/** One row in the recent jobs table. */
export interface RecentJobRowData {
  id: string;
  type: string;
  customer: string;
  location: string;
  status: PillStatus;
  earningsUsd: number;
  time: string;
}

/** One itemised line on the motorist order summary. */
export interface OrderLineItemData {
  label: string;
  amountUsd: number;
}

/** One vehicle on a fleet account. */
export interface FleetVehicleData {
  plate: string;
  spentUsd: number;
}

/** One fuel grade shown on a nearby station card. */
export interface FuelGradeOption {
  label: string;
  priceUsdPerLitre: number;
  available: boolean;
}

/** A gas station offered to the motorist. */
export interface StationData {
  id: string;
  name: string;
  verified: boolean;
  distanceKm: number;
  rating: number;
  openNow: boolean;
  grades: FuelGradeOption[];
}

/** A garage/mechanic offered to the motorist. */
export interface GarageData {
  id: string;
  name: string;
  verified: boolean;
  distanceKm: number;
  rating: number;
  etaMinutes: number;
  services: string[];
}

/** One job on the driver console. */
export interface DriverJobData {
  id: string;
  serviceType: string;
  customerName: string;
  address: string;
  distanceKm: number;
  etaMinutes: number;
  payoutUsd: number;
}

/** Bottom tab keys for the motorist app. */
export type TabKey = "home" | "orders" | "profile";
