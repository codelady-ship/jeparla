import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { apiFetch, isNotFound, postImageSearch, type Query } from "./http";
import { relayHeaders } from "@/lib/auth/tokens";
import type { JeparlaApi } from "./types";

/**
 * The public catalog API as pages use it with the real backend: catalog reads are cached on
 * the Next.js server ("use cache", profiles in next.config.ts) and shared by every visitor;
 * search and suggestions depend on the visitor's query, are not cached and name the visitor to
 * the backend rate limit (see `visitorHeaders`).
 *
 * A failed call is never cached: a page that was rendered before keeps its last good copy,
 * a fresh render shows the error boundary.
 */

type Profile = "catalog" | "prices";

async function cached<T>(path: string, query: Query | undefined, profile: Profile): Promise<T> {
  "use cache";
  if (profile === "prices") cacheLife("prices");
  else cacheLife("catalog");
  cacheTag("api", profile);
  return apiFetch<T>(path, { query });
}

async function cachedOrNull<T>(path: string): Promise<T | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag("api", "catalog");
  try {
    return await apiFetch<T>(path);
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/**
 * Lets the backend count rate limits per visitor instead of per frontend server
 * (backend ClientIpFilter, JEPARLA_FRONTEND_TOKEN on both sides). The visitor address is
 * the one the hosting platform wrote (Vercel and Netlify set x-real-ip / x-forwarded-for,
 * Cloudflare cf-connecting-ip). Without the token nothing extra is sent.
 */
export async function visitorHeaders(): Promise<Record<string, string>> {
  if (!process.env.JEPARLA_FRONTEND_TOKEN) return {};
  const h = await headers();
  return relayHeaders((name) => h.get(name));
}

const enc = encodeURIComponent;

export const liveApi: JeparlaApi = {
  listProducts: (f = {}) => cached("/products", f, "catalog"),
  getProductsByIds: async (ids) =>
    ids.length ? cached("/products", { ids: ids.join(",") }, "catalog") : [],
  getCompareItems: async (ids) =>
    ids.length ? cached("/variants", { ids: ids.join(",") }, "catalog") : [],
  getProduct: (slug) => cachedOrNull(`/products/${enc(slug)}`),
  listCategories: () => cached("/categories", undefined, "catalog"),
  listFinenesses: () => cached("/finenesses", undefined, "catalog"),
  listStores: (params = {}) => cached("/stores", params, "catalog"),
  getStore: (slug) => cachedOrNull(`/stores/${enc(slug)}`),
  listStoreProducts: (slug, f = {}) => cached(`/stores/${enc(slug)}/products`, f, "catalog"),
  search: async (q, type = "all", page = 0) =>
    apiFetch("/search", { query: { q, type, page }, headers: await visitorHeaders() }),
  suggest: async (q) =>
    apiFetch("/search/suggest", { query: { q }, headers: await visitorHeaders() }),
  // Search by photo (#163): never cached, the photo goes straight to the backend, which
  // counts its limit per visitor (#222).
  imageSearchStatus: () => apiFetch("/search/image/status"),
  searchByImage: async (image) => postImageSearch(image, await visitorHeaders()),
  latestMetalPrices: () => cached("/metal-prices/latest", undefined, "prices"),
  metalPriceHistory: (metal, days = 30) =>
    cached("/metal-prices/history", { metal, days }, "prices"),
  latestExchangeRates: () => cached("/exchange-rates/latest", undefined, "prices"),
};
