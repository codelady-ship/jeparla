import type { PricingMode } from "@/types/api";

/** Body of POST /merchant/products/bulk-pricing (#109), or the error key of the form. */
export function bulkPricingBody(
  ids: number[],
  mode: PricingMode | "",
  labor: string,
):
  | { ok: true; body: { ids: number[]; pricingMode?: PricingMode; laborPerGram?: string } }
  | { ok: false; error: "pricingEmpty" | "laborInvalid" | "laborRequired" } {
  const text = labor.trim().replace(",", ".");
  if (text && !/^\d{1,10}(\.\d{1,2})?$/.test(text)) return { ok: false, error: "laborInvalid" };
  if (mode === "FIXED") return { ok: true, body: { ids, pricingMode: "FIXED" } };
  if (mode === "METAL_LINKED") {
    if (!text) return { ok: false, error: "laborRequired" };
    return { ok: true, body: { ids, pricingMode: "METAL_LINKED", laborPerGram: text } };
  }
  if (!text) return { ok: false, error: "pricingEmpty" };
  return { ok: true, body: { ids, laborPerGram: text } };
}
