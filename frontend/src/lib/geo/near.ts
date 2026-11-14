/**
 * The buyer's point for "near me" (#116). It travels only as the `near` query
 * parameter, rounded to 0.01 degree (about 1 km): enough to sort stores, too coarse
 * to point at a home. The backend does not store or log it.
 */
const PAIR = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export type LatLng = { lat: number; lng: number };

/** Parses "lat,lng"; anything invalid or out of range gives null. */
export function parseNear(value: string | undefined | null): LatLng | null {
  const m = value ? PAIR.exec(value) : null;
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** "40.41,49.87": two decimals, the form the page puts into the URL. */
export function formatNear({ lat, lng }: LatLng): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/** Validates and coarsens a raw `near` parameter; null when it is not a valid point. */
export function normalizeNear(value: string | undefined | null): string | null {
  const p = parseNear(value);
  return p ? formatNear(p) : null;
}

/** Great-circle distance in km (a map distance, not money or weight). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}
