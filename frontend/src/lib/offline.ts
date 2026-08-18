import type { ServiceType, SymptomType } from "./api";
import { EMERGENCY_LINE } from "./services";

/**
 * No-data fallback for the REQUEST step. If the device is offline the request
 * is stashed locally with a panic-ready SMS template, so a stranded motorist
 * is never left with a dead button.
 */

export type OfflineRequest = {
  key: string;
  queuedAt: number;
  pin: [number, number];
  symptom: SymptomType | null;
  service: ServiceType;
  address: string;
  note: string;
  litres: number;
  fuelType: string;
};

const QUEUE_KEY = "fuellink.offline.requests";

export function listOfflineRequests(): OfflineRequest[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineRequest[]) : [];
  } catch {
    return [];
  }
}

export function queueOfflineRequest(request: OfflineRequest): void {
  const next = [...listOfflineRequests(), request];
  localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
}

export function clearOfflineRequest(key: string): void {
  localStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(listOfflineRequests().filter((r) => r.key !== key)),
  );
}

/** Pre-filled SMS message a no-data motorist can send straight to the line. */
export function offlineSmsBody(request: OfflineRequest): string {
  const need =
    request.service === "fuel" && request.litres > 0
      ? `${request.litres.toFixed(0)} L ${request.fuelType}`
      : request.service.replace("_", " ");
  return (
    `FuelLink request. ${need}. Pin: ${request.pin[0].toFixed(4)}, ` +
    `${request.pin[1].toFixed(4)}${request.address ? `, ${request.address}` : ""}` +
    `${request.note ? `. Note: ${request.note}` : ""}`
  );
}

export function offlineSmsHref(request: OfflineRequest): string {
  return `sms:${EMERGENCY_LINE}?body=${encodeURIComponent(offlineSmsBody(request))}`;
}
