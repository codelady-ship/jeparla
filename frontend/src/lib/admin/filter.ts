import { matchesQuery } from "@/lib/search/normalize";

/**
 * Admin lists: free-text search (Azerbaijani letters folded) plus one status
 * filter. `text` picks the searchable words of a row.
 */
export function filterList<T extends { status: string }>(
  rows: readonly T[],
  q: string,
  status: string,
  text: (row: T) => string,
): T[] {
  const query = q.trim();
  return rows.filter(
    (r) => (status === "ALL" || r.status === status) && (!query || matchesQuery(text(r), query)),
  );
}

/** A status from ?status=, or the list's default when missing or unknown. */
export function pickStatus<S extends string>(raw: string, allowed: readonly S[], fallback: S): S {
  return (allowed as readonly string[]).includes(raw) ? (raw as S) : fallback;
}

/** dd.mm.yyyy from an ISO date, the same in every locale (no timezone shift). */
export function shortDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export const STORE_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED", "BLOCKED"] as const;
export const PRODUCT_FILTERS = ["ALL", "IN_REVIEW", "APPROVED", "RETURNED", "INACTIVE"] as const;
export const CHECK_FILTERS = ["ALL", "PENDING", "VERIFIED", "REJECTED"] as const;
export const USER_FILTERS = ["ALL", "USER", "MERCHANT", "ADMIN"] as const;
export const REPORT_FILTERS = ["ALL", "OPEN", "RESOLVED", "DISMISSED"] as const;
export const AUDIT_FILTERS = [
  "ALL",
  "STORE",
  "PRODUCT",
  "CHECK",
  "USER",
  "CATALOG",
  "PRICE",
  "REPORT",
] as const;
