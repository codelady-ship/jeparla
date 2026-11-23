import type { DocMeta, ProductStep, SignupPhoto, StoreStep } from "./schemas";

/**
 * Wizard draft in localStorage so Back, refresh and a closed tab lose nothing.
 * The password and the documents themselves are never stored: only the file names. Step 4
 * photos are kept as small downscaled JPEGs (at most PHOTO_MAX_COUNT) until they are sent.
 */
export type SellerDraft = {
  account: { name: string; phone: string };
  store: StoreStep;
  docs: DocMeta[];
  product: ProductStep;
  /** Step 4 photos (#317): of the first product, or photo drafts for the cabinet. */
  photos: SignupPhoto[];
  /** How many photos the API kept; null before sending (the done screen tells the truth). */
  photosSaved: number | null;
  /** Steps the seller finished (1-4); the stepper shows them green. */
  done: number[];
  /** Set when step 4 was skipped on purpose. */
  productSkipped: boolean;
  /** The first product's draft id when the API created it (the done screen links to it). */
  productId: number | null;
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
    sellerKind: "PRECIOUS",
    taxId: "",
    codeAccepted: false,
  },
  docs: [],
  product: { productName: "", category: "", fineness: "", weight: "", price: "" },
  photos: [],
  photosSaved: null,
  done: [],
  productSkipped: false,
  productId: null,
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
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
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
