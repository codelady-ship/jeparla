import { afterEach, describe, expect, it } from "vitest";
import { favorites } from "./saved-list";
import { priceChange, readSavedPrices, toggleFavorite } from "./saved-prices";

const AZN = (amount: string) => ({ amount, currency: "AZN" as const });
const saved = (amount: string) => ({ ...AZN(amount), savedAt: "2026-11-01T10:00:00.000Z" });

describe("toggleFavorite", () => {
  afterEach(() => {
    favorites.clear();
    window.localStorage.clear();
  });

  it("remembers the price and date when added and forgets them when removed", () => {
    const now = new Date("2026-11-14T09:00:00Z");
    expect(toggleFavorite(7, AZN("1250.00"), now)).toBe(true);
    expect(favorites.has(7)).toBe(true);
    expect(readSavedPrices()[7]).toEqual({
      amount: "1250.00",
      currency: "AZN",
      savedAt: "2026-11-14T09:00:00.000Z",
    });
    expect(toggleFavorite(7, AZN("1300.00"))).toBe(false);
    expect(readSavedPrices()[7]).toBeUndefined();
  });
});

describe("priceChange", () => {
  it("reports the exact decimal difference and direction", () => {
    expect(priceChange(saved("1250.10"), AZN("1300.00"))).toEqual({
      direction: "up",
      difference: "49.90",
    });
    // 0.1 + 0.2 style float errors must not appear.
    expect(priceChange(saved("0.30"), AZN("0.10"))).toEqual({
      direction: "down",
      difference: "0.20",
    });
  });

  it("says nothing when the price did not move, nothing was saved or currencies differ", () => {
    expect(priceChange(saved("1250.00"), AZN("1250"))).toBeNull();
    expect(priceChange(undefined, AZN("1250.00"))).toBeNull();
    expect(
      priceChange({ ...saved("1250.00"), currency: "USD" as never }, AZN("1300.00")),
    ).toBeNull();
  });
});
