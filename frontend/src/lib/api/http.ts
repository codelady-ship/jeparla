import { IMAGE_SEARCH_ERRORS, type ProductSummary } from "@/types/api";
import type { JeparlaApi } from "./types";

/**
 * REST implementation against the Spring Boot backend. Wired up and verified in
 * issue #41 (6.5); until then the mock is the default.
 */
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

type Query = Record<string, string | number | boolean | string[] | number[] | undefined>;

export function toSearchParams(query: Query = {}): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)));
    else sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function get<T>(path: string, query?: Query): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}${toSearchParams(query)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await get<T>(path);
  } catch (e) {
    if (e instanceof Error && e.message.endsWith(": 404")) return null;
    throw e;
  }
}

const enc = encodeURIComponent;

export const httpApi: JeparlaApi = {
  listProducts: (f = {}) => get("/products", f),
  getProductsByIds: (ids) => get("/products", { ids: ids.join(",") }),
  getCompareItems: (ids) => get("/variants", { ids: ids.join(",") }),
  getProduct: (slug) => getOrNull(`/products/${enc(slug)}`),
  listCategories: () => get("/categories"),
  listFinenesses: () => get("/finenesses"),
  listStores: (params = {}) => get("/stores", params),
  getStore: (slug) => getOrNull(`/stores/${enc(slug)}`),
  listStoreProducts: (slug, f = {}) => get(`/stores/${enc(slug)}/products`, f),
  search: (q, type = "all", page = 0) => get("/search", { q, type, page }),
  suggest: (q) => get("/search/suggest", { q }),
  imageSearchStatus: () => get("/search/image/status"),
  searchByImage: async (image) => {
    const body = new FormData();
    body.append("image", image, "photo.jpg");
    const res = await fetch(`${BASE}/api/v1/search/image`, {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true, products: (await res.json()) as ProductSummary[] };
    if (res.status === 429) return { ok: false, error: "rate_limited" };
    const code = ((await res.json().catch(() => ({}))) as { code?: string }).code;
    return {
      ok: false,
      error: IMAGE_SEARCH_ERRORS.find((e) => e === code) ?? "search.image_unreadable",
    };
  },
  latestMetalPrices: () => get("/metal-prices/latest"),
  metalPriceHistory: (metal, days = 30) => get("/metal-prices/history", { metal, days }),
};
