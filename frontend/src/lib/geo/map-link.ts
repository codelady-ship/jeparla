/**
 * "Open in map" (#116): an external map link, no map library on the page. The point is
 * the store's own public location (the seller sets it in the cabinet); without it the
 * address is searched as text.
 */
export type StoreGeo = { lat: string; lng: string };

const SEARCH = "https://www.google.com/maps/search/?api=1&query=";

export function mapHref(geo: StoreGeo | null | undefined, address?: string): string | null {
  if (geo) return `${SEARCH}${encodeURIComponent(`${geo.lat},${geo.lng}`)}`;
  const text = address?.trim();
  return text ? `${SEARCH}${encodeURIComponent(text)}` : null;
}
