import { describe, expect, it } from "vitest";
import { fullMonths, mockStoreFacts, mockStorePreview } from "./index";
import { PRODUCTS, STORES } from "./fixtures";

describe("sample store facts (#108)", () => {
  it("are counted from the sample products, never typed in", () => {
    for (const store of STORES) {
      const facts = mockStoreFacts(store.slug, new Date("2026-11-15T12:00:00+04:00"))!;
      const own = PRODUCTS.filter((p) => p.store.id === store.id);
      expect(facts.activeProducts).toBe(own.length);
      expect(facts.activeProducts).toBe(store.productCount);
      const linked = own.filter((p) => p.variants.some((v) => v.pricingMode === "METAL_LINKED"));
      expect(facts.metalLinkedPrice.count).toBe(linked.length);
      if (own.length === 0) {
        expect(facts.metalLinkedPrice.percent).toBeNull();
        expect(facts.catalogUpdatedAt).toBeNull();
      } else {
        expect(facts.metalLinkedPrice.percent).toBe(Math.floor((linked.length * 100) / own.length));
      }
      expect(facts.monthsOnJeparla).toBe(2);
    }
  });

  it("answers null for an unknown store", () => {
    expect(mockStoreFacts("no-such-store")).toBeNull();
    expect(mockStorePreview("no-such-store")).toBeNull();
  });

  it("counts full calendar months only", () => {
    const from = new Date("2026-09-15T12:00:00Z");
    expect(fullMonths(from, new Date("2026-10-14T12:00:00Z"))).toBe(0);
    expect(fullMonths(from, new Date("2026-10-15T12:00:00Z"))).toBe(1);
    expect(fullMonths(from, new Date("2026-08-01T12:00:00Z"))).toBe(0);
  });

  it("previews a store with its newest product photo", () => {
    const store = STORES[0];
    const preview = mockStorePreview(store.slug)!;
    expect(preview.name).toBe(store.name);
    expect(preview.productCount).toBe(store.productCount);
    const newest = PRODUCTS.filter((p) => p.store.id === store.id).sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    )[0];
    expect(preview.coverImageUrl).toBe(newest?.images[0]?.url ?? null);
  });
});
