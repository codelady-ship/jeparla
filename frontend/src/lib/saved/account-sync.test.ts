import { describe, expect, it } from "vitest";
import { importBody, mergeAccount, type AccountFavorite } from "./account-sync";

const at = "2026-10-01T08:00:00.000Z";

describe("importBody", () => {
  it("sends the ids and only well-formed saved prices", () => {
    expect(
      importBody([1, 2, 3], {
        1: { amount: "250.50", currency: "AZN", savedAt: at },
        2: { amount: "1,5", currency: "AZN", savedAt: at },
      }),
    ).toEqual({
      productIds: [1, 2, 3],
      prices: [{ productId: 1, amount: "250.50", currency: "AZN", savedAt: at }],
    });
  });
});

describe("mergeAccount", () => {
  it("takes the account list and its saved prices, keeping a price only the browser knows", () => {
    const rows: AccountFavorite[] = [
      { product: { id: 9 }, savedAt: "2026-11-02T00:00:00Z", savedPrice: null },
      {
        product: { id: 4 },
        savedAt: "2026-11-01T00:00:00Z",
        savedPrice: { amount: "100.00", currency: "AZN" as const },
      },
    ];
    const merged = mergeAccount(rows, {
      4: { amount: "90.00", currency: "AZN", savedAt: at },
      9: { amount: "70.00", currency: "AZN", savedAt: at },
      5: { amount: "10.00", currency: "AZN", savedAt: at },
    });
    // The browser list is oldest first; the account answers newest first.
    expect(merged.ids).toEqual([4, 9]);
    expect(merged.prices).toEqual({
      4: { amount: "100.00", currency: "AZN", savedAt: "2026-11-01T00:00:00Z" },
      9: { amount: "70.00", currency: "AZN", savedAt: at },
    });
  });
});
