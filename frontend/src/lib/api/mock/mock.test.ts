import { describe, expect, it } from "vitest";
import { compareDecimal, gramPrice } from "@/lib/pricing";
import { toSearchParams } from "../http";
import { CATEGORIES, LATEST_METAL_PRICES, PRODUCTS, STORES } from "./fixtures";
import { mockApi, paginate } from "./index";

const DECIMAL = /^\d+(\.\d+)?$/;

describe("fixtures", () => {
  it("has the agreed size: 6 stores, 12 categories, 60 products", () => {
    expect(STORES).toHaveLength(6);
    expect(CATEGORIES).toHaveLength(12);
    expect(PRODUCTS).toHaveLength(60);
  });

  it("keeps money and weight as decimal strings", () => {
    for (const p of PRODUCTS) {
      expect(p.priceFrom.amount).toMatch(DECIMAL);
      expect(p.weightGrams).toMatch(DECIMAL);
      expect(typeof p.priceFrom.amount).toBe("string");
    }
  });

  it("uses only fake phone numbers", () => {
    for (const s of STORES) expect(s.whatsapp).toMatch(/^\+99450000000\d$/);
  });

  it("has unique slugs and SKUs and names in all three languages", () => {
    expect(new Set(PRODUCTS.map((p) => p.slug)).size).toBe(60);
    expect(new Set(PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku))).size).toBe(60);
    for (const p of PRODUCTS)
      for (const l of ["az", "en", "ru"] as const) expect(p.name[l]).toBeTruthy();
  });

  it("derives gram prices from ounce prices", () => {
    for (const m of LATEST_METAL_PRICES) expect(m.pricePerGram).toBe(gramPrice(m.pricePerOunce));
  });
});

describe("mockApi.listProducts", () => {
  it("paginates 24 per page by default", async () => {
    const page = await mockApi.listProducts();
    expect(page.content).toHaveLength(24);
    expect(page.totalElements).toBe(60);
    expect(page.totalPages).toBe(3);
  });

  it("filters by parent category including its children", async () => {
    const rings = await mockApi.listProducts({ category: "uzukler", size: 96 });
    const ids = new Set(rings.content.map((p) => p.categoryId));
    expect([...ids].every((id) => [1, 2, 3].includes(id))).toBe(true);
    expect(rings.totalElements).toBeGreaterThan(0);
  });

  it("combines store, metal, fineness and price filters", async () => {
    const res = await mockApi.listProducts({
      store: ["ayzer-zerger"],
      metal: "GOLD",
      fineness: [585],
      maxPrice: "5000",
      size: 96,
    });
    for (const p of res.content) {
      expect(p.store.slug).toBe("ayzer-zerger");
      expect(p.metal).toBe("GOLD");
      expect(p.fineness).toBe(585);
      expect(compareDecimal(p.priceFrom.amount, "5000")).toBeLessThanOrEqual(0);
    }
  });

  it("sorts by price ascending", async () => {
    const { content } = await mockApi.listProducts({ sort: "price_asc", size: 96 });
    for (let i = 1; i < content.length; i++) {
      expect(
        compareDecimal(content[i - 1].priceFrom.amount, content[i].priceFrom.amount),
      ).toBeLessThanOrEqual(0);
    }
  });

  it("does not leak detail fields into summaries", async () => {
    const { content } = await mockApi.listProducts({ size: 1 });
    expect(content[0]).not.toHaveProperty("variants");
  });
});

describe("mockApi search", () => {
  it("finds products typed without Azerbaijani letters", async () => {
    const res = await mockApi.search("qizil uzuy");
    expect(res.products.totalElements).toBeGreaterThan(0);
  });

  it("groups suggestions by store, category and product, max 5 each", async () => {
    const s = await mockApi.suggest("sirga");
    expect(s.categories.map((c) => c.slug)).toContain("sirgalar");
    expect(s.products.length).toBeLessThanOrEqual(5);
    const byStore = await mockApi.suggest("xezer");
    expect(byStore.stores.map((x) => x.slug)).toContain("xezer-inci");
  });

  it("returns null for unknown slugs", async () => {
    expect(await mockApi.getProduct("yoxdur")).toBeNull();
    expect(await mockApi.getStore("yoxdur")).toBeNull();
  });
});

describe("helpers", () => {
  it("paginate clamps page size", () => {
    expect(paginate([1, 2, 3], 0, 1000).size).toBe(96);
  });

  it("toSearchParams repeats arrays and skips empty values", () => {
    expect(toSearchParams({ store: ["a", "b"], q: "", page: 0 })).toBe("?store=a&store=b&page=0");
  });
});
