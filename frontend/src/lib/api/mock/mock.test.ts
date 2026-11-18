import Big from "big.js";
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

describe("fixtures priceBreakdown (#104)", () => {
  const variants = PRODUCTS.flatMap((p) => p.variants);
  const sum = (...amounts: (string | undefined)[]) =>
    amounts.reduce((acc, a) => acc.plus(a ?? "0"), new Big(0));

  it("is on every demo variant and its total is the variant price", () => {
    for (const v of variants) {
      expect(v.priceBreakdown).toBeDefined();
      expect(v.priceBreakdown!.total).toEqual(v.price);
      expect(v.priceBreakdown!.laborSeparate).toBe(false);
    }
  });

  it("METAL_LINKED: parts at the demo CBAR quote add up to the price (no clamp)", () => {
    const linked = variants.filter((v) => v.pricingMode === "METAL_LINKED");
    expect(linked.length).toBeGreaterThan(0);
    for (const v of linked) {
      const b = v.priceBreakdown!;
      const quote = LATEST_METAL_PRICES.find((m) => m.metal === v.fineness!.metal)!;
      expect(b.metal).toMatchObject({
        weightGrams: v.weightGrams,
        fineness: v.fineness!.value,
        gramPrice: { amount: quote.pricePerGram, currency: "AZN" },
        quoteDate: quote.date,
        source: "CBAR",
      });
      expect(b.labor).toMatchObject({
        perGram: { amount: "12.00" },
        fixed: { amount: "20.00" },
      });
      expect(b.markup?.percent).toBe("15.00");
      expect(b.clamped).toBeNull();
      const total = sum(
        b.metal!.value.amount,
        b.labor!.amount.amount,
        b.stone?.amount,
        b.markup!.amount.amount,
      );
      // Each part is rounded to cents on its own: the sum is within a few cents of the price.
      expect(total.minus(v.price.amount).abs().lte("0.03")).toBe(true);
    }
  });

  it("METAL_LINKED without a stone has no stone line, never 0.00", () => {
    const plain = PRODUCTS.find(
      (p) => p.stones.length === 0 && p.variants[0].pricingMode === "METAL_LINKED",
    )!;
    expect(plain.variants[0].priceBreakdown!.stone).toBeNull();
  });

  it("FIXED: total and price per gram only, no invented split", () => {
    const fixed = variants.filter((v) => v.pricingMode === "FIXED");
    expect(fixed.length).toBeGreaterThan(0);
    for (const v of fixed) {
      const b = v.priceBreakdown!;
      expect([b.metal, b.labor, b.stone, b.markup, b.clamped]).toEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
      expect(b.pricePerGram?.amount).toBe(
        new Big(v.price.amount).div(v.weightGrams!).round(2, Big.roundHalfUp).toFixed(2),
      );
    }
  });

  it("reaches the product page and compare through the mock API", async () => {
    const product = await mockApi.getProduct(PRODUCTS[0].slug);
    expect(product?.variants[0].priceBreakdown?.metal).not.toBeNull();
    const [item] = await mockApi.getCompareItems([PRODUCTS[0].variants[0].id]);
    expect(item.variant.priceBreakdown).toEqual(PRODUCTS[0].variants[0].priceBreakdown);
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

describe("sample states for #106 and #128", () => {
  it("has one bijouterie product: FIXED, no metal, never in a metal filter", async () => {
    const fashion = PRODUCTS.filter((p) => p.materialKind === "FASHION");
    expect(fashion.map((p) => p.slug)).toEqual(["qolbaqlar-polad-60"]);
    const [p] = fashion;
    expect(p).toMatchObject({ metal: null, fineness: null, pricingMode: "FIXED" });
    expect(p.variants[0].priceBreakdown?.metal).toBeNull();
    expect((await mockApi.listProducts({ kind: "FASHION" })).totalElements).toBe(1);
    for (const metal of ["GOLD", "SILVER", "PLATINUM"] as const) {
      const page = await mockApi.listProducts({ metal, size: 96 });
      expect(page.content.some((x) => x.materialKind === "FASHION")).toBe(false);
    }
  });

  it("has a hallmark and a label photo on product 13, on the product page only", async () => {
    const page = await mockApi.listProducts({ hallmarkPhoto: true });
    expect(page.content.map((p) => p.id)).toEqual([13]);
    expect(page.content[0]).not.toHaveProperty("evidencePhotos");
    const product = await mockApi.getProduct(page.content[0].slug);
    expect(product?.evidencePhotos?.map((e) => [e.kind, e.checked])).toEqual([
      ["HALLMARK", true],
      ["TAG", false],
    ]);
    expect((await mockApi.getStoreFacts("ayzer-zerger"))?.hallmarkPhoto).toEqual({
      count: 1,
      percent: 10,
    });
  });
});
