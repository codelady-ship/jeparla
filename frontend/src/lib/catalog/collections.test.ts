import { describe, expect, it } from "vitest";
import { adminApi } from "@/lib/api/admin";
import { toInput } from "@/lib/api/merchant";
import { mockApi } from "@/lib/api/mock";
import { OCCASIONS, PRODUCT_OCCASIONS, PRODUCTS } from "@/lib/api/mock/fixtures";
import { collectionOrderSchema, collectionSchema } from "@/lib/admin/settings";
import { compareDecimal } from "@/lib/pricing";
import { toProductRequest } from "@/lib/merchant/backend";
import { EMPTY_INPUT } from "@/lib/merchant/draft";
import { basicsStep } from "@/lib/merchant/schemas";
import { parseFilters } from "./filters";

/** Occasion collections (#115): demo data, the catalog filter, seller tags and admin forms. */
describe("occasion collections", () => {
  it("starts with the six the owner chose, in order and in three languages", async () => {
    const list = await mockApi.listCollections();
    expect(list.map((c) => c.slug)).toEqual([
      "nisan",
      "toy",
      "hediyye",
      "gundelik",
      "kisi-ucun",
      "usaq-ucun",
    ]);
    expect(list.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(list.find((c) => c.slug === "kisi-ucun")?.name).toEqual({
      az: "Kişi üçün",
      en: "For him",
      ru: "Для него",
    });
  });

  it("counts exactly the listed products the collection page shows", async () => {
    for (const c of OCCASIONS) {
      const page = await mockApi.listProducts({ collection: c.slug, size: 96 });
      expect(page.totalElements).toBe(c.productCount);
      expect(c.productCount).toBeGreaterThan(0);
      for (const p of page.content) expect(PRODUCT_OCCASIONS.get(p.id)).toContain(c.slug);
    }
  });

  it("covers each card with a real photo of one of its own products, never an AI image", async () => {
    const files = new Set<string>();
    for (const c of await mockApi.listCollections()) {
      expect(c.cover).not.toBeNull();
      expect(c.cover!.aiGenerated).toBe(false);
      const own = PRODUCTS.filter((p) => PRODUCT_OCCASIONS.get(p.id)?.includes(c.slug));
      expect(own.some((p) => p.images.some((i) => i.url === c.cover!.url))).toBe(true);
      files.add(c.cover!.url);
    }
    // The demo set has one photo of gold rings, shared by Nişan and Kişi üçün.
    expect(files.size).toBeGreaterThanOrEqual(5);
  });

  it("tags engagement rings as Nişan and leaves untagged pieces out", async () => {
    const nisan = await mockApi.listProducts({ collection: "nisan", size: 96 });
    const ids = new Set(nisan.content.map((p) => p.id));
    for (const p of PRODUCTS) expect(ids.has(p.id)).toBe(p.categoryId === 2);
  });

  it("combines a collection with the budget filter and finds nothing for an unknown one", async () => {
    const gifts = await mockApi.listProducts({ collection: "hediyye", maxPrice: "1000", size: 96 });
    expect(gifts.totalElements).toBeGreaterThan(0);
    for (const p of gifts.content)
      expect(compareDecimal(p.priceFrom.amount, "1000")).toBeLessThanOrEqual(0);
    expect((await mockApi.listProducts({ collection: "no-such" })).totalElements).toBe(0);
  });

  it("is the page itself, never a URL filter of /products", () => {
    expect(parseFilters({ collection: "nisan", maxPrice: "500" })).toEqual({ maxPrice: "500" });
  });

  it("hands the seller's tags to the form and back to the API", () => {
    const ring = PRODUCTS.find((p) => p.categoryId === 2)!;
    const input = toInput(ring);
    expect(input.collectionIds).toEqual([1]);
    expect(
      toProductRequest({ ...input, collectionIds: [3, 1, 3] }, [], null).collectionIds,
    ).toEqual([3, 1]);
    // A draft from before #115 has no tags: null keeps what the product has.
    expect(toProductRequest(EMPTY_INPUT, [], null).collectionIds).toBeNull();
    const basics = { name: "Qızıl üzük", category: "1", audience: "UNISEX", description: "" };
    expect(basicsStep.safeParse({ ...basics, collectionIds: [1, 2] }).success).toBe(true);
    expect(basicsStep.safeParse({ ...basics, collectionIds: [0] }).success).toBe(false);
  });

  it("checks the admin forms: slug, three names, a full order without repeats", async () => {
    const name = { az: "Ad günü", en: "Birthday", ru: "День рождения" };
    expect(collectionSchema.safeParse({ slug: "ad-gunu", name }).data?.active).toBe(true);
    expect(collectionSchema.safeParse({ slug: "Ad günü", name }).success).toBe(false);
    expect(
      collectionSchema.safeParse({ slug: "ad-gunu", name: { ...name, ru: " " } }).success,
    ).toBe(false);
    expect(collectionOrderSchema.safeParse({ ids: [2, 1, 3] }).success).toBe(true);
    expect(collectionOrderSchema.safeParse({ ids: [1, 1] }).success).toBe(false);
    const admin = await adminApi.collections();
    expect(admin.map((c) => c.sortOrder)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(admin.every((c) => c.active)).toBe(true);
  });
});
