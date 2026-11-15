import type { Audience, MaterialKind, MetalType, ProductFilters, ProductSort } from "@/types/api";

/**
 * Catalog filters live in the URL so a filtered list can be shared and restored.
 * Param names match GET /api/v1/products, except `page`, which is 1-based in the URL
 * (people read it) and 0-based in the API.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export const METALS: MetalType[] = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"];
export const KINDS: MaterialKind[] = ["PRECIOUS", "FASHION"];
export const AUDIENCES: Audience[] = ["WOMEN", "MEN", "KIDS", "UNISEX"];

/**
 * The audience filter of GET /api/v1/products (#121): a UNISEX piece suits women and men too, so it is in
 * their lists; KIDS and UNISEX match only themselves.
 */
export function audienceMatches(piece: Audience, wanted: Audience): boolean {
  return piece === wanted || (piece === "UNISEX" && (wanted === "WOMEN" || wanted === "MEN"));
}

export const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc", "weight_asc"];
export const SHAPES = ["ROUND", "OVAL", "PRINCESS", "EMERALD", "CUSHION", "PEAR"] as const;
export const COLORS = ["D", "E", "F", "G", "H", "I", "J", "K"] as const;
export const CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1"] as const;
/**
 * Products per catalog page. 12 = three rows on desktop, six on phones; more pages
 * via the pagination links (real URLs with ?page=). 24 cards made the first load of
 * /products about twice as heavy as a category page on phones (#160).
 */
export const PAGE_SIZE = 12;

const DECIMAL = /^\d{1,9}(\.\d{1,3})?$/;
const SLUG = /^[a-z0-9-]{1,80}$/;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim();
const all = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).map((x) => x.trim());
const oneOf = <T extends string>(list: readonly T[], v: string | undefined) =>
  list.includes(v as T) ? (v as T) : undefined;
const someOf = <T extends string>(list: readonly T[], v: string | string[] | undefined) => {
  const out = [...new Set(all(v).filter((x): x is T => list.includes(x as T)))];
  return out.length ? out : undefined;
};
const decimal = (raw: string | undefined) => {
  const v = raw?.replace(",", ".");
  return v && DECIMAL.test(v) ? v : undefined;
};
const flag = (v: string | undefined) => (v === "true" || v === "1" ? true : undefined);

/** Turns untrusted URL params into valid filters; anything malformed is dropped. */
export function parseFilters(sp: SearchParams): ProductFilters {
  const fineness = [...new Set(all(sp.fineness).filter((x) => /^\d{3}$/.test(x)))].map(Number);
  const store = [...new Set(all(sp.store).filter((x) => SLUG.test(x)))];
  const category = first(sp.category);
  const city = first(sp.city);
  const q = first(sp.q);
  const page = Number(first(sp.page));

  const f: ProductFilters = {
    q: q ? q.slice(0, 100) : undefined,
    category: category && SLUG.test(category) ? category : undefined,
    store: store.length ? store : undefined,
    kind: oneOf(KINDS, first(sp.kind)),
    audience: oneOf(AUDIENCES, first(sp.audience)),
    metal: oneOf(METALS, first(sp.metal)),
    fineness: fineness.length ? fineness : undefined,
    minWeight: decimal(first(sp.minWeight)),
    maxWeight: decimal(first(sp.maxWeight)),
    minPrice: decimal(first(sp.minPrice)),
    maxPrice: decimal(first(sp.maxPrice)),
    verified: flag(first(sp.verified)),
    hallmarkPhoto: flag(first(sp.hallmarkPhoto)),
    inStock: flag(first(sp.inStock)),
    city: city ? city.slice(0, 60) : undefined,
    shape: someOf(SHAPES, sp.shape),
    minCarat: decimal(first(sp.minCarat)),
    maxCarat: decimal(first(sp.maxCarat)),
    color: someOf(COLORS, sp.color),
    clarity: someOf(CLARITIES, sp.clarity),
    sort: oneOf(SORTS, first(sp.sort)),
    page: Number.isInteger(page) && page > 1 ? page - 1 : undefined,
  };
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as ProductFilters;
}

/** Inverse of parseFilters: a query string ("" or "?a=1&b=2") with a 1-based page. */
export function toQuery(f: ProductFilters): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value === undefined || value === "" || value === false) continue;
    if (key === "size") continue;
    if (key === "page") {
      if (typeof value === "number" && value > 0) sp.set("page", String(value + 1));
      continue;
    }
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)));
    else sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** One removable chip per active value; `without` is the filter set after removing it. */
export type ActiveFilter = { key: keyof ProductFilters; value: string; without: ProductFilters };

const CHIP_KEYS: (keyof ProductFilters)[] = [
  "q",
  "category",
  "store",
  "kind",
  "audience",
  "metal",
  "fineness",
  "minWeight",
  "maxWeight",
  "minPrice",
  "maxPrice",
  "verified",
  "hallmarkPhoto",
  "inStock",
  "city",
  "shape",
  "minCarat",
  "maxCarat",
  "color",
  "clarity",
];

export function activeFilters(f: ProductFilters): ActiveFilter[] {
  const { page: _page, ...base } = f;
  return CHIP_KEYS.flatMap((key) => {
    const v = (base as ProductFilters)[key];
    if (v === undefined) return [];
    if (Array.isArray(v)) {
      return v.map((item) => {
        const rest = (v as (string | number)[]).filter((x) => x !== item);
        return {
          key,
          value: String(item),
          without: { ...base, [key]: rest.length ? rest : undefined },
        };
      });
    }
    return [{ key, value: String(v), without: { ...base, [key]: undefined } }];
  });
}

/** Filters that narrow the result (sort and page don't count). */
export function hasActiveFilters(f: ProductFilters): boolean {
  return activeFilters(f).length > 0;
}
