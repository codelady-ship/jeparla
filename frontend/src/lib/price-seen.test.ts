import { beforeEach, describe, expect, it } from "vitest";
import {
  CHECK_TTL_MS,
  markPricesSeen,
  readCheck,
  readSeen,
  SEEN_EVENT,
  unseenChanges,
  writeCheck,
} from "./price-seen";

const azn = (amount: string) => ({ amount, currency: "AZN" as const });
const saved = {
  "1": { ...azn("100.00"), savedAt: "2026-11-01T00:00:00Z" },
  "2": { ...azn("200.00"), savedAt: "2026-11-01T00:00:00Z" },
};

describe("favourites price note (#112)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("counts only moved prices the visitor has not seen", () => {
    const products = [
      { id: 1, priceFrom: azn("110.00") },
      { id: 2, priceFrom: azn("200.00") },
      { id: 3, priceFrom: azn("50.00") },
    ];
    // 2 did not move, 3 has no saved price: only 1 counts.
    expect(unseenChanges(products, saved, {})).toBe(1);
    markPricesSeen(products);
    expect(unseenChanges(products, saved, readSeen())).toBe(0);
    // It moves again: the note comes back.
    expect(unseenChanges([{ id: 1, priceFrom: azn("120.00") }], saved, readSeen())).toBe(1);
  });

  it("ignores a price in another currency", () => {
    expect(
      unseenChanges([{ id: 1, priceFrom: { amount: "30.00", currency: "USD" } }], saved, {}),
    ).toBe(0);
  });

  it("keeps a check for the same favourites for an hour and drops it when seen", () => {
    let events = 0;
    const listener = () => events++;
    window.addEventListener(SEEN_EVENT, listener);
    writeCheck({ ids: "1,2", count: 1, at: 1000 });
    expect(readCheck("1,2", 1000 + CHECK_TTL_MS - 1)?.count).toBe(1);
    expect(readCheck("1,2", 1000 + CHECK_TTL_MS)).toBeNull();
    expect(readCheck("1", 1001)).toBeNull();
    markPricesSeen([]);
    expect(readCheck("1,2", 1001)).toBeNull();
    expect(events).toBe(1);
    window.removeEventListener(SEEN_EVENT, listener);
  });
});
