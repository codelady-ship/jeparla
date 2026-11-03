/**
 * wa.me link to a store with a prefilled message naming the product, so the seller
 * knows exactly what the buyer means (PLAN 5.6).
 */
export function whatsappLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
