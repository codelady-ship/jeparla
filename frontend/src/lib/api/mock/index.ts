import { compareDecimal } from "@/lib/pricing";
import { matchesQuery } from "@/lib/search/normalize";
import type { Category, Page, Product, ProductFilters, ProductSummary, Stone } from "@/types/api";
import type { JeparlaApi } from "../types";
import {
  CATEGORIES,
  FINENESSES,
  LATEST_METAL_PRICES,
  METAL_PRICE_HISTORY,
  PRODUCTS,
  STORES,
} from "./fixtures";

const DEFAULT_SIZE = 24;
const MAX_SIZE = 96;

function toSummary(p: Product): ProductSummary {
  const { description: _d, variants: _v, stones: _s, status: _st, ...summary } = p;
  return summary;
}

function categoryIds(slug: string): Set<number> {
  const root = CATEGORIES.find((c) => c.slug === slug);
  if (!root) return new Set();
  const ids = new Set([root.id]);
  for (const c of CATEGORIES) if (c.parentId !== null && ids.has(c.parentId)) ids.add(c.id);
  return ids;
}

function productText(p: Product): string {
  const cat = CATEGORIES.find((c) => c.id === p.categoryId);
  return [p.name.az, p.name.en, p.name.ru, p.store.name, cat?.name.az, cat?.name.en, cat?.name.ru]
    .filter(Boolean)
    .join(" ");
}

function categoryText(c: Category): string {
  return `${c.name.az} ${c.name.en} ${c.name.ru}`;
}

function hasDiamondFilter(f: ProductFilters): boolean {
  return Boolean(
    f.shape?.length || f.minCarat || f.maxCarat || f.color?.length || f.clarity?.length,
  );
}

function diamondMatches(s: Stone, f: ProductFilters): boolean {
  if (s.type !== "DIAMOND") return false;
  if (f.shape?.length && !(s.shape && f.shape.includes(s.shape))) return false;
  if (f.color?.length && !(s.color && f.color.includes(s.color))) return false;
  if (f.clarity?.length && !(s.clarity && f.clarity.includes(s.clarity))) return false;
  if (f.minCarat && !(s.carat && compareDecimal(s.carat, f.minCarat) >= 0)) return false;
  if (f.maxCarat && !(s.carat && compareDecimal(s.carat, f.maxCarat) <= 0)) return false;
  return true;
}

function filterProducts(f: ProductFilters): Product[] {
  const cats = f.category ? categoryIds(f.category) : null;
  return PRODUCTS.filter((p) => {
    if (p.status !== "APPROVED") return false;
    if (cats && !cats.has(p.categoryId)) return false;
    if (f.store?.length && !f.store.includes(p.store.slug)) return false;
    if (f.metal && p.metal !== f.metal) return false;
    if (f.fineness?.length && !f.fineness.includes(p.fineness)) return false;
    if (f.minWeight && compareDecimal(p.weightGrams, f.minWeight) < 0) return false;
    if (f.maxWeight && compareDecimal(p.weightGrams, f.maxWeight) > 0) return false;
    if (f.minPrice && compareDecimal(p.priceFrom.amount, f.minPrice) < 0) return false;
    if (f.maxPrice && compareDecimal(p.priceFrom.amount, f.maxPrice) > 0) return false;
    if (f.verified && p.verification.documents !== "VERIFIED") return false;
    if (f.inStock && p.stockStatus === "OUT_OF_STOCK") return false;
    if (f.city && p.store.city !== f.city) return false;
    if (hasDiamondFilter(f) && !p.stones.some((s) => diamondMatches(s, f))) return false;
    if (f.q && !matchesQuery(productText(p), f.q)) return false;
    return true;
  });
}

function sortProducts(items: Product[], sort: ProductFilters["sort"]): Product[] {
  const out = [...items];
  switch (sort) {
    case "price_asc":
      return out.sort((a, b) => compareDecimal(a.priceFrom.amount, b.priceFrom.amount));
    case "price_desc":
      return out.sort((a, b) => compareDecimal(b.priceFrom.amount, a.priceFrom.amount));
    case "weight_asc":
      return out.sort((a, b) => compareDecimal(a.weightGrams, b.weightGrams));
    case "newest":
      return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id);
    default:
      return out;
  }
}

export function paginate<T>(items: T[], page = 0, size = DEFAULT_SIZE): Page<T> {
  const s = Math.min(Math.max(1, size), MAX_SIZE);
  const p = Math.max(0, page);
  return {
    content: items.slice(p * s, p * s + s),
    page: p,
    size: s,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / s),
  };
}

function listProducts(f: ProductFilters = {}): Page<ProductSummary> {
  const sorted = sortProducts(filterProducts(f), f.sort);
  return paginate(sorted.map(toSummary), f.page, f.size);
}

/** In-memory implementation of the API, used only when NEXT_PUBLIC_USE_MOCK is "true". */
export const mockApi: JeparlaApi = {
  async listProducts(filters) {
    return listProducts(filters);
  },
  async getProductsByIds(ids) {
    const byId = new Map(PRODUCTS.filter((p) => p.status === "APPROVED").map((p) => [p.id, p]));
    return ids.flatMap((id) => {
      const p = byId.get(id);
      return p ? [toSummary(p)] : [];
    });
  },
  async getCompareItems(variantIds) {
    return variantIds.flatMap((vid) => {
      const p = PRODUCTS.find(
        (x) => x.status === "APPROVED" && x.variants.some((v) => v.id === vid),
      );
      const variant = p?.variants.find((v) => v.id === vid);
      return p && variant ? [{ product: toSummary(p), variant, stones: p.stones }] : [];
    });
  },
  async getProduct(slug) {
    return PRODUCTS.find((p) => p.slug === slug && p.status === "APPROVED") ?? null;
  },
  async listCategories() {
    return CATEGORIES;
  },
  async listFinenesses() {
    return FINENESSES;
  },
  async listStores(params = {}) {
    return STORES.filter(
      (s) =>
        (!params.city || s.city === params.city) &&
        (!params.q || matchesQuery(`${s.name} ${s.city}`, params.q)),
    ).map(
      ({
        description: _d,
        address: _a,
        whatsapp: _w,
        phone: _p,
        openingHours: _o,
        geo: _g,
        createdAt: _c,
        ...summary
      }) => summary,
    );
  },
  async getStore(slug) {
    return STORES.find((s) => s.slug === slug) ?? null;
  },
  async listStoreProducts(slug, filters = {}) {
    return listProducts({ ...filters, store: [slug] });
  },
  async search(q, type = "all", page = 0) {
    const stores = await this.listStores({ q });
    const categories = CATEGORIES.filter((c) => matchesQuery(categoryText(c), q));
    const products =
      type === "all" || type === "products"
        ? listProducts({ q, page })
        : paginate<ProductSummary>([], page);
    return {
      query: q,
      products,
      stores: type === "all" || type === "stores" ? stores : [],
      categories: type === "all" || type === "categories" ? categories : [],
    };
  },
  async suggest(q) {
    if (!q.trim()) return { query: q, stores: [], categories: [], products: [] };
    const stores = (await this.listStores({ q })).slice(0, 5);
    const categories = CATEGORIES.filter((c) => matchesQuery(categoryText(c), q)).slice(0, 5);
    const products = filterProducts({ q }).slice(0, 5);
    return {
      query: q,
      stores: stores.map(({ slug, name, city }) => ({ slug, name, city })),
      categories: categories.map(({ slug, name }) => ({ slug, name })),
      products: products.map(({ slug, name, priceFrom }) => ({ slug, name, priceFrom })),
    };
  },
  async latestMetalPrices() {
    return LATEST_METAL_PRICES;
  },
  async metalPriceHistory(metal, days = 30) {
    return METAL_PRICE_HISTORY.filter((p) => p.metal === metal).slice(-days);
  },
};
