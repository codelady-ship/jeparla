import { matchesQuery } from "@/lib/search/normalize";
import type { ProductStatus } from "@/types/api";
import type { MerchantProductRow } from "@/types/merchant";

export const STATUS_FILTERS = [
  "ALL",
  "APPROVED",
  "IN_REVIEW",
  "DRAFT",
  "RETURNED",
  "INACTIVE",
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Search in all three names (Azerbaijani letters folded) and filter by status. */
export function filterRows(
  rows: readonly MerchantProductRow[],
  q: string,
  status: StatusFilter,
): MerchantProductRow[] {
  const query = q.trim();
  return rows.filter(
    (r) =>
      (status === "ALL" || r.status === status) &&
      (!query || matchesQuery(`${r.name.az} ${r.name.en} ${r.name.ru}`, query)),
  );
}

/** Only live products can be paused, and only paused ones can go live again. */
export function toggledStatus(status: ProductStatus): "APPROVED" | "INACTIVE" | null {
  return status === "APPROVED" ? "INACTIVE" : status === "INACTIVE" ? "APPROVED" : null;
}
