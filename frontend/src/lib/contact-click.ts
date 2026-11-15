import { CONTACT_QUESTIONS, type ContactQuestion } from "@/lib/whatsapp";

/**
 * What the product page reports when the buyer opens WhatsApp (#111): no personal data.
 * `ref` is the shared store link source of this visit (#100), when there is one.
 */
export type ContactClick = { productId: number; question: ContactQuestion; ref?: string | null };

/** Longest source the backend looks at (ReferralSource.MAX_LENGTH). */
const MAX_REF = 64;

/** Reads the beacon body; anything unexpected gives null and is not forwarded. */
export function parseContactClick(text: string): ContactClick | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { productId, question, ref } = data as Record<string, unknown>;
  if (typeof productId !== "number" || !Number.isSafeInteger(productId) || productId <= 0) {
    return null;
  }
  const known = CONTACT_QUESTIONS.find((q) => q === question);
  if (!known) return null;
  const source = typeof ref === "string" ? ref.trim() : "";
  return source && source.length <= MAX_REF
    ? { productId, question: known, ref: source }
    : { productId, question: known };
}

/**
 * Counts the click in the background. `sendBeacon` survives the page opening WhatsApp in a
 * new tab or app; without it a keepalive fetch is used. Errors are ignored.
 */
export function sendContactClick(click: ContactClick): void {
  const body = JSON.stringify(click);
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon?.("/api/contact-click", body)) {
      return;
    }
    void fetch("/api/contact-click", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // Statistics never get in the buyer's way.
  }
}
