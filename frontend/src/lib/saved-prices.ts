import Big from "big.js";
import { favorites } from "@/lib/saved-list";
import type { Decimal, Money } from "@/types/api";

/**
 * The "from" price of a favourite at the moment it was added (#112), so the favourites
 * page can say how it changed since. Guests keep it in this browser; the account copy
 * (favorites.saved_price) comes with the backend part.
 */
export type SavedPrice = Money & { savedAt: string };

const KEY = "jeparla-favorite-prices";

export function readSavedPrices(): Record<string, SavedPrice> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, SavedPrice>) : {};
  } catch {
    return {};
  }
}

function write(next: Record<string, SavedPrice>) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the change note is simply not shown later.
  }
}

/** Adds or removes a favourite and keeps its saved price in step. */
export function toggleFavorite(id: number, price: Money, now = new Date()): boolean {
  const on = favorites.toggle(id) === true;
  const prices = readSavedPrices();
  if (on) prices[id] = { ...price, savedAt: now.toISOString() };
  else delete prices[id];
  write(prices);
  return on;
}

export type PriceChange = { direction: "up" | "down"; difference: Decimal };

/**
 * How the price moved since it was saved. Null when it did not move, when nothing was
 * saved, or when the currencies differ (no conversion is guessed).
 */
export function priceChange(saved: SavedPrice | undefined, now: Money): PriceChange | null {
  if (!saved || saved.currency !== now.currency) return null;
  let diff: Big;
  try {
    diff = new Big(now.amount).minus(saved.amount);
  } catch {
    return null;
  }
  if (diff.eq(0)) return null;
  return { direction: diff.gt(0) ? "up" : "down", difference: diff.abs().toFixed(2) };
}
