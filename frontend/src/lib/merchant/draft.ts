import type { PricingInput, ProductInput } from "@/types/merchant";

/**
 * Product form drafts in localStorage: one for a new product ("new") and one per
 * edited product id, so a refresh or a closed tab loses nothing. Images are kept
 * as downscaled data URLs until the backend upload exists; if the browser runs
 * out of space the draft still lives for this page view.
 */
export type ProductDraft = {
  input: ProductInput;
  /** Steps the merchant finished (1-5); the stepper shows them green. */
  done: number[];
  /** ISO time of the last change, shown as "saved at". */
  savedAt: string | null;
};

export const EMPTY_PRICING: PricingInput = Object.freeze({
  laborPerGram: "0",
  laborFixed: "0",
  stonePrice: "0",
  markupPercent: "0",
  minPrice: "",
  maxPrice: "",
}) as PricingInput;

export const EMPTY_INPUT: ProductInput = Object.freeze({
  images: [],
  name: "",
  category: "",
  description: "",
  metal: "",
  fineness: "",
  pricingMode: "FIXED",
  pricing: EMPTY_PRICING,
  variants: [{ key: "v1", size: "", weightGrams: "", price: "", stockStatus: "IN_STOCK" }],
  stones: [],
  docs: [],
}) as ProductInput;

export const EMPTY_PRODUCT_DRAFT: ProductDraft = Object.freeze({
  input: EMPTY_INPUT,
  done: [],
  savedAt: null,
}) as ProductDraft;

export const STEPS = 5;
const PREFIX = "jeparla-product-draft:";

type Store = {
  subscribe(cb: () => void): () => void;
  get(): ProductDraft;
  serverSnapshot(): ProductDraft;
  /** True when something is saved for this key (a draft to resume). */
  exists(): boolean;
  update(fn: (d: ProductDraft) => ProductDraft): void;
  clear(): void;
  /** False when the last write did not fit in localStorage. */
  persisted(): boolean;
};

const stores = new Map<string, Store>();

/** Draft store for "new" or a product id; the same object for the same key. */
export function productDraft(key: string, initial: ProductInput = EMPTY_INPUT): Store {
  const existing = stores.get(key);
  if (existing) return existing;
  const storageKey = PREFIX + key;
  const first: ProductDraft = {
    input: initial,
    done: key === "new" ? [] : [1, 2, 3, 4],
    savedAt: null,
  };
  let cache: ProductDraft | null = null;
  let ok = true;
  const listeners = new Set<() => void>();

  const read = (): ProductDraft => {
    if (cache) return cache;
    try {
      const raw = globalThis.localStorage?.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as Partial<ProductDraft>) : null;
      cache = parsed
        ? {
            input: {
              ...first.input,
              ...parsed.input,
              pricing: { ...first.input.pricing, ...parsed.input?.pricing },
            },
            done: Array.isArray(parsed.done) ? parsed.done.filter((n) => n >= 1 && n <= STEPS) : [],
            savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
          }
        : first;
    } catch {
      cache = first;
    }
    return cache;
  };

  const store: Store = {
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    get: read,
    serverSnapshot: () => first,
    exists() {
      try {
        return globalThis.localStorage?.getItem(storageKey) != null;
      } catch {
        return false;
      }
    },
    update(fn) {
      cache = { ...fn(read()), savedAt: new Date().toISOString() };
      try {
        globalThis.localStorage?.setItem(storageKey, JSON.stringify(cache));
        ok = true;
      } catch {
        // Quota (large photos) or private mode: keep it for this page view.
        ok = false;
      }
      listeners.forEach((l) => l());
    },
    clear() {
      cache = null;
      ok = true;
      try {
        globalThis.localStorage?.removeItem(storageKey);
      } catch {
        // ignore
      }
      listeners.forEach((l) => l());
    },
    persisted: () => ok,
  };
  stores.set(key, store);
  return store;
}

/** First step that is not finished yet; the merchant cannot jump past it. */
export function firstOpenStep(done: readonly number[]): number {
  for (let s = 1; s <= STEPS; s++) if (!done.includes(s)) return s;
  return STEPS;
}
