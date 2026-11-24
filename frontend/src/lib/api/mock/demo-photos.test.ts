import { describe, expect, it } from "vitest";
import { PRODUCTS, STORES } from "./fixtures";

const fitted = (url: string) => url.endsWith(".webp");

describe("demo photos fitted by the admin (#327)", () => {
  it("shows the fitted photo on every gold earrings product, in the stores that sell them", () => {
    const earrings = PRODUCTS.filter(
      (p) => p.metal === "GOLD" && (p.categoryId === 4 || p.categoryId === 12),
    );
    for (const p of earrings)
      expect(
        p.images.map((i) => i.url),
        p.slug,
      ).toEqual(["/demo/earrings-gold-6.webp"]);

    const stores = STORES.filter((s) =>
      PRODUCTS.some((p) => p.store.id === s.id && p.images.some((i) => fitted(i.url))),
    ).map((s) => s.slug);
    // Yeni Ulduz sells no gold earrings, so its products keep their .jpg photos.
    expect(stores).toEqual([
      "ayzer-zerger",
      "lale-atelye",
      "nergiz-gold",
      "xezer-inci",
      "semender-zerger",
    ]);
  });

  it("puts a fitted photo only on gold earrings, never labelled as AI", () => {
    for (const p of PRODUCTS) {
      for (const img of p.images.filter((i) => fitted(i.url))) {
        expect(p.metal, p.slug).toBe("GOLD");
        expect([4, 12], p.slug).toContain(p.categoryId);
        expect(img.aiGenerated).toBe(false);
      }
    }
  });
});
