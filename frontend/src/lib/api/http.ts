import type { JeparlaApi } from "./types";

/**
 * REST client of the Spring Boot backend (PLAN 5.5). Plain fetch, no Next.js imports: the
 * backend contract generator (backend/src/test/resources/contract/generate.mjs) loads this file
 * in Node to record the exact requests. Pages use the cached wrapper in ./live.ts.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

type QueryValue = string | number | boolean | string[] | number[] | undefined;
export type Query = Record<string, QueryValue>;

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

/**
 * A failed API call. `status` 0 means the backend did not answer (down, timeout, DNS);
 * `code` is the ProblemDetail code (`merchant.no_store`, `rate_limited` ...) when there is one.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly code: string | null = null,
    readonly detail: string | null = null,
    readonly fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(`${path} failed: ${status}${code ? ` (${code})` : ""}`);
    this.name = "ApiError";
  }
}

export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** Access token of the signed-in user (cabinet and admin calls). */
  token?: string | null;
  /** UI language: the backend answers error texts in it. Data always has az, en and ru. */
  locale?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

/** ProblemDetail fields the backend sends (RFC 9457 + `code`, `errors`). */
type Problem = { code?: string; detail?: string; errors?: { field: string; message: string }[] };

/** One call to `/api/v1{path}`; JSON in, JSON out, `null` for 204. Throws ApiError. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, token, locale, headers = {}, timeoutMs = 10_000 } = options;
  const url = `${API_BASE}/api/v1${path}${toSearchParams(query)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(locale && { "Accept-Language": locale }),
        ...headers,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError(0, `${method} ${path}`);
  }
  if (!res.ok) {
    const problem = (await res.json().catch(() => ({}))) as Problem;
    throw new ApiError(
      res.status,
      `${method} ${path}`,
      problem.code ?? null,
      problem.detail ?? null,
      problem.errors ?? [],
    );
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

const get = <T>(path: string, query?: Query) => apiFetch<T>(path, { query });

async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await get<T>(path);
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

const enc = encodeURIComponent;

/** Uncached REST implementation of the public catalog API. */
export const httpApi: JeparlaApi = {
  listProducts: (f = {}) => get("/products", f),
  // An empty ids list would turn into the paged list (no ids param): answer it here.
  getProductsByIds: async (ids) => (ids.length ? get("/products", { ids: ids.join(",") }) : []),
  getCompareItems: async (ids) => (ids.length ? get("/variants", { ids: ids.join(",") }) : []),
  getProduct: (slug) => getOrNull(`/products/${enc(slug)}`),
  listCategories: () => get("/categories"),
  listFinenesses: () => get("/finenesses"),
  listStores: (params = {}) => get("/stores", params),
  getStore: (slug) => getOrNull(`/stores/${enc(slug)}`),
  listStoreProducts: (slug, f = {}) => get(`/stores/${enc(slug)}/products`, f),
  search: (q, type = "all", page = 0) => get("/search", { q, type, page }),
  suggest: (q) => get("/search/suggest", { q }),
  latestMetalPrices: () => get("/metal-prices/latest"),
  metalPriceHistory: (metal, days = 30) => get("/metal-prices/history", { metal, days }),
};
