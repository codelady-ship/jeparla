import { priceChange, type SavedPrice } from "@/lib/saved-prices";
import type { Money, ProductSummary } from "@/types/api";

/**
 * The header note on the favourites link (#112): how many favourites changed price since the
 * visitor last opened the favourites page. Opening the page marks the current prices as
 * seen, so the note is quiet until a price moves again. No pop-up, no push, no email.
 */
const SEEN_KEY = "jeparla-favorite-prices-seen";
const CHECK_KEY = "jeparla-favorite-prices-check";
/** The header asks for the current prices at most once per this period (per tab session). */
export const CHECK_TTL_MS = 60 * 60 * 1000;
export const SEEN_EVENT = "jeparla:favorite-prices-seen";

type Seen = Record<string, string>;
export type PriceCheck = { ids: string; count: number; at: number };

const priceKey = (m: Money) => `${m.amount} ${m.currency}`;

export function readSeen(): Seen {
  try {
    const raw = globalThis.localStorage?.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Seen) : {};
  } catch {
    return {};
  }
}

/** Favourites whose price moved since it was saved and since the visitor last saw it. */
export function unseenChanges(
  products: Pick<ProductSummary, "id" | "priceFrom">[],
  saved: Record<string, SavedPrice>,
  seen: Seen,
): number {
  return products.filter(
    (p) => priceChange(saved[p.id], p.priceFrom) !== null && seen[p.id] !== priceKey(p.priceFrom),
  ).length;
}

/** The favourites page shows every change: from now on these prices are seen. */
export function markPricesSeen(products: Pick<ProductSummary, "id" | "priceFrom">[]) {
  const seen: Seen = {};
  for (const p of products) seen[p.id] = priceKey(p.priceFrom);
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(seen));
    globalThis.sessionStorage?.removeItem(CHECK_KEY);
  } catch {
    // Storage blocked: the header note simply is not shown.
  }
  globalThis.dispatchEvent?.(new Event(SEEN_EVENT));
}

export function readCheck(ids: string, now = Date.now()): PriceCheck | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(CHECK_KEY);
    const check = raw ? (JSON.parse(raw) as PriceCheck) : null;
    return check && check.ids === ids && now - check.at < CHECK_TTL_MS ? check : null;
  } catch {
    return null;
  }
}

export function writeCheck(check: PriceCheck) {
  try {
    globalThis.sessionStorage?.setItem(CHECK_KEY, JSON.stringify(check));
  } catch {
    // Storage blocked: the header asks again on the next page.
  }
}
