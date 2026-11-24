import { describe, expect, it } from "vitest";
import { PRODUCTS, STORES } from "./fixtures";

const fitted = (url: string) => url.endsWith(".webp");

describe("demo photos fitted by the admin (#327)", () => {
  it("shows fitted photos in every demo store", () => {
    for (const s of STORES) {
      const own = PRODUCTS.filter((p) => p.store.id === s.id);
      expect(
        own.some((p) => p.images.some((i) => fitted(i.url))),
        s.slug,
      ).toBe(true);
    }
  });

  it("puts a fitted photo only on its own product type, never labelled as AI", () => {
    const byCategory: Record<number, RegExp> = {
      4: /^\/demo\/earrings-gold-\d\.webp$/,
      8: /^\/demo\/bracelet-gold-\d\.webp$/,
      12: /^\/demo\/earrings-gold-\d\.webp$/,
    };
    for (const p of PRODUCTS) {
      for (const img of p.images.filter((i) => fitted(i.url))) {
        expect(p.metal, p.slug).toBe("GOLD");
        expect(img.url, p.slug).toMatch(byCategory[p.categoryId]);
        expect(img.aiGenerated).toBe(false);
      }
    }
  });
});
