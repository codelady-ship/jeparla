import { API_BASE } from "@/lib/api/http";
import { USING_MOCK } from "@/lib/api/mode";

/**
 * Where a visitor of a shared store link came from (#100). The store page reads `ref` (or
 * `utm_source`) once, tells the backend about the visit from the browser (so the backend sees
 * the visitor's own address and user agent and can leave out bots and reloads) and keeps the
 * source for this browser tab, so a WhatsApp click on one of the store's products later in the
 * same visit is counted for that source too. Nothing personal is stored: only the store slug
 * and the source word, in sessionStorage, which the browser clears with the tab.
 */
export type Referral = { slug: string; source: string };

const KEY = "jeparla:referral";
const SENT = "jeparla:referral-sent";
/** Longest value the backend looks at (ReferralSource.MAX_LENGTH). */
const MAX = 64;

/** The source of a store link: `ref` wins over `utm_source`; blank or too long is none. */
export function sourceFrom(search: string | URLSearchParams): string | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const raw = (params.get("ref") || params.get("utm_source") || "").trim();
  return raw && raw.length <= MAX ? raw : null;
}

type SessionStore = Pick<Storage, "getItem" | "setItem">;

function session(): SessionStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readReferral(store: SessionStore | null = session()): Referral | null {
  try {
    const value = JSON.parse(store?.getItem(KEY) ?? "null") as Referral | null;
    return value && typeof value.slug === "string" && typeof value.source === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

/**
 * Remembers the source and answers whether this visit still has to be reported: once per
 * tab for the same store and source (the backend also folds reloads, this saves the call).
 */
export function rememberReferral(
  referral: Referral,
  store: SessionStore | null = session(),
): boolean {
  if (!store) return true;
  try {
    store.setItem(KEY, JSON.stringify(referral));
    const sent = `${referral.slug}|${referral.source}`;
    if (store.getItem(SENT) === sent) return false;
    store.setItem(SENT, sent);
  } catch {
    // Storage full or blocked: report the visit anyway, the backend folds repeats.
  }
  return true;
}

/** A fire-and-forget POST that survives leaving the page (WhatsApp opens a new app). */
function beacon(url: string) {
  // Sample data has no backend to count anything.
  if (USING_MOCK) return;
  try {
    void fetch(url, { method: "POST", keepalive: true, mode: "cors", credentials: "omit" }).catch(
      () => undefined,
    );
  } catch {
    // Counting must never break the page.
  }
}

const enc = encodeURIComponent;

/** POST /stores/{slug}/visits?ref= */
export function reportVisit(referral: Referral) {
  beacon(`${API_BASE}/api/v1/stores/${enc(referral.slug)}/visits?ref=${enc(referral.source)}`);
}

/**
 * POST /products/{id}/contact-click, with the source of this visit when the product belongs
 * to the store the visitor came to through a shared link.
 */
export function reportContactClick(productId: number, storeSlug: string) {
  const referral = readReferral();
  const ref = referral && referral.slug === storeSlug ? `?ref=${enc(referral.source)}` : "";
  beacon(`${API_BASE}/api/v1/products/${productId}/contact-click${ref}`);
}
