import { favorites } from "@/lib/saved-list";
import { readSavedPrices, writeSavedPrices, type SavedPrice } from "@/lib/saved-prices";
import type { Money } from "@/types/api";
import { pushFavorite, signedIn } from "./account";

/** One row of GET/POST /api/v1/favorites (FavoriteDto). */
export type AccountFavorite = {
  product: { id: number };
  savedAt: string;
  savedPrice: Money | null;
};

/** The import body: ids oldest first plus the price each one had when it was saved here. */
export function importBody(ids: readonly number[], prices: Record<string, SavedPrice>) {
  return {
    productIds: ids.slice(-100),
    prices: ids.slice(-100).flatMap((id) => {
      const p = prices[id];
      return p && /^\d{1,10}(\.\d{1,2})?$/.test(p.amount) && /^[A-Z]{3}$/.test(p.currency)
        ? [{ productId: id, amount: p.amount, currency: p.currency, savedAt: p.savedAt }]
        : [];
    }),
  };
}

/**
 * Merges the account list (newest first) into the browser: the account decides which
 * products are saved and, where it has one, the saved price; a price only this browser
 * knows is kept.
 */
export function mergeAccount(
  rows: readonly AccountFavorite[],
  local: Record<string, SavedPrice>,
): { ids: number[]; prices: Record<string, SavedPrice> } {
  const ids = [...rows].reverse().map((r) => r.product.id);
  const prices: Record<string, SavedPrice> = {};
  for (const r of rows) {
    const id = r.product.id;
    if (r.savedPrice) prices[id] = { ...r.savedPrice, savedAt: r.savedAt };
    else if (local[id]) prices[id] = local[id];
  }
  return { ids, prices };
}

let running: Promise<void> | null = null;

/**
 * Sends this browser's favourites with their saved prices to the account (the backend
 * merges and keeps the first saved price), then takes the merged list back. Called after
 * sign-in and when a signed-in buyer opens /favorites. Errors leave the browser list as is.
 */
export function syncFavorites(): Promise<void> {
  if (!signedIn()) return Promise.resolve();
  running ??= (async () => {
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importBody(favorites.get(), readSavedPrices())),
      });
      if (!res.ok) return;
      const rows = (await res.json()) as AccountFavorite[];
      if (!Array.isArray(rows)) return;
      const merged = mergeAccount(rows, readSavedPrices());
      writeSavedPrices(merged.prices);
      favorites.replace(merged.ids);
    } catch {
      // Offline or signed out meanwhile: try again next time.
    } finally {
      running = null;
    }
  })();
  return running;
}

/** "Clear all" on /favorites: empties this browser's list and, when signed in, the account's. */
export function clearFavorites(): void {
  const ids = favorites.get();
  favorites.clear();
  writeSavedPrices({});
  for (const id of ids) pushFavorite(id, false);
}
