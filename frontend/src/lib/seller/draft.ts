import type { DocMeta, ProductStep, StoreStep } from "./schemas";

/**
 * Wizard draft in localStorage so Back, refresh and a closed tab lose nothing.
 * The password and the files themselves are never stored: only the file names.
 */
export type SellerDraft = {
  account: { name: string; phone: string };
  store: StoreStep;
  docs: DocMeta[];
  product: ProductStep;
  /** Steps the seller finished (1-4); the stepper shows them green. */
  done: number[];
  /** Set when step 4 was skipped on purpose. */
  productSkipped: boolean;
  /** Sent successfully: /sell shows the congratulations screen. */
  submitted: boolean;
};

export const EMPTY_DRAFT: SellerDraft = Object.freeze({
  account: { name: "", phone: "" },
  store: {
    storeName: "",
    whatsapp: "",
    city: "",
    address: "",
    social: "",
    legalType: "COMPANY",
    taxId: "",
    codeAccepted: false,
  },
  docs: [],
  product: { productName: "", category: "", fineness: "", weight: "", price: "" },
  done: [],
  productSkipped: false,
  submitted: false,
}) as SellerDraft;

const KEY = "jeparla-seller-draft";
let cache: SellerDraft | null = null;
const listeners = new Set<() => void>();

function read(): SellerDraft {
  if (cache) return cache;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SellerDraft>) : {};
    cache = {
      ...EMPTY_DRAFT,
      ...parsed,
      account: { ...EMPTY_DRAFT.account, ...parsed.account },
      store: { ...EMPTY_DRAFT.store, ...parsed.store },
      product: { ...EMPTY_DRAFT.product, ...parsed.product },
      docs: Array.isArray(parsed.docs) ? parsed.docs : [],
      done: Array.isArray(parsed.done) ? parsed.done.filter((n) => n >= 1 && n <= 4) : [],
    };
  } catch {
    cache = EMPTY_DRAFT;
  }
  return cache;
}

function write(next: SellerDraft) {
  cache = next;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: keep it for this page view.
  }
  listeners.forEach((l) => l());
}

export const sellerDraft = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get: read,
  serverSnapshot: () => EMPTY_DRAFT,
  update(fn: (d: SellerDraft) => SellerDraft) {
    write(fn(read()));
  },
  clear() {
    cache = null;
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      // ignore
    }
    listeners.forEach((l) => l());
  },
};

/** First step that is not finished yet; the seller cannot jump past it. */
export function firstOpenStep(done: readonly number[]): number {
  for (let s = 1; s <= 4; s++) if (!done.includes(s)) return s;
  return 4;
}
