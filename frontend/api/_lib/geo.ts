const ROAD_DETOUR_FACTOR = 1.35;
const AVERAGE_URBAN_SPEED_KMH = 32.0;
const DISPATCH_OVERHEAD_MINUTES = 6;

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const r = 6371.0088;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function roadDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  return Math.round(haversineKm(lat1, lng1, lat2, lng2) * ROAD_DETOUR_FACTOR * 100) / 100;
}

export function etaMinutes(distanceKm: number): number {
  return Math.round(distanceKm / AVERAGE_URBAN_SPEED_KMH * 60 + DISPATCH_OVERHEAD_MINUTES);
}
