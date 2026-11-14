/**
 * wa.me link to a store with a prefilled message naming the product, so the seller
 * knows exactly what the buyer means (PLAN 5.6).
 */
export function whatsappLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Ready questions a buyer can pick before writing (#111). GENERAL is the plain
 * "interested in this item" message; the texts live in Pdp.contact in the message files.
 */
export const CONTACT_QUESTIONS = ["GENERAL", "AVAILABILITY", "SIZE", "VISIT", "PRICE"] as const;
export type ContactQuestion = (typeof CONTACT_QUESTIONS)[number];
