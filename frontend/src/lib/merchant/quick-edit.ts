import { z } from "zod";
import type { MetalType, PricingMode } from "@/types/api";
import type { ProductInput } from "@/types/merchant";

/**
 * Quick editing of drafts row by row in the products table (#109): category, metal, fineness,
 * weight and price mode. Everything else stays as stored; the server merges these fields into
 * the stored product and saves it with the same checks as the product form.
 */

export const QUICK_METALS = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"] as const;
export const QUICK_MAX_IDS = 100;

export type QuickFields = {
  /** Category slug. */
  category: string;
  metal: MetalType | "";
  /** Fineness id as a string, "" when none. */
  fineness: string;
  /** Weight of the only variant; "" when not given or the product has several variants. */
  weightGrams: string;
  pricingMode: PricingMode;
};

export type QuickRow = QuickFields & {
  id: number;
  /** Bijouterie (#128): no metal, no fineness, FIXED price only. */
  fashion: boolean;
  /** Weight is edited here only for a product with one variant. */
  variantCount: number;
};

/** The quick fields of a stored product (as the product form reads it). */
export function quickFromInput(id: number, input: ProductInput): QuickRow {
  const fashion = input.materialKind === "FASHION";
  return {
    id,
    fashion,
    variantCount: input.variants.length,
    category: input.category,
    metal: fashion ? "" : input.metal,
    fineness: fashion ? "" : input.fineness,
    weightGrams: input.variants.length === 1 ? (input.variants[0]?.weightGrams ?? "") : "",
    pricingMode: fashion ? "FIXED" : input.pricingMode,
  };
}

/** The stored product with the quick fields applied; untouched fields stay as they were. */
export function applyQuick(input: ProductInput, f: QuickFields): ProductInput {
  const fashion = input.materialKind === "FASHION";
  const single = input.variants.length === 1;
  return {
    ...input,
    category: f.category,
    ...(!fashion && { metal: f.metal, fineness: f.fineness, pricingMode: f.pricingMode }),
    variants: single
      ? [{ ...input.variants[0], weightGrams: f.weightGrams.trim().replace(",", ".") }]
      : input.variants,
  };
}

export const sameQuick = (a: QuickFields, b: QuickFields) =>
  a.category === b.category &&
  a.metal === b.metal &&
  a.fineness === b.fineness &&
  a.weightGrams.trim() === b.weightGrams.trim() &&
  a.pricingMode === b.pricingMode;

/** Body of PATCH /api/merchant/products/{id}/quick; messages are Merchant.errors keys. */
export const quickSchema = z
  .object({
    category: z.string().trim().min(1, "required").max(120),
    metal: z.enum(QUICK_METALS).or(z.literal("")),
    fineness: z.string().regex(/^\d{0,9}$/, "required"),
    weightGrams: z
      .string()
      .trim()
      .transform((v) => v.replace(",", "."))
      .refine(
        (v) => v === "" || (/^\d{1,5}(\.\d{1,3})?$/.test(v) && Number(v) > 0),
        "decimalInvalid",
      ),
    pricingMode: z.enum(["FIXED", "METAL_LINKED"]),
  })
  .superRefine((f, ctx) => {
    if (f.fineness !== "" && f.metal === "")
      ctx.addIssue({ code: "custom", path: ["metal"], message: "required" });
    if (f.metal !== "" && f.fineness === "")
      ctx.addIssue({ code: "custom", path: ["fineness"], message: "required" });
    if (f.pricingMode === "METAL_LINKED") {
      if (f.metal === "") ctx.addIssue({ code: "custom", path: ["metal"], message: "required" });
      if (f.weightGrams === "")
        ctx.addIssue({ code: "custom", path: ["weightGrams"], message: "required" });
    }
  });

/** Field errors of a row as { field: key }, or null when it can be sent. */
export function quickErrors(f: QuickFields, fashion: boolean): Record<string, string> | null {
  const parsed = quickSchema.safeParse(
    fashion ? { ...f, metal: "", fineness: "", pricingMode: "FIXED" } : f,
  );
  if (parsed.success) return null;
  const out: Record<string, string> = {};
  for (const issue of parsed.error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}
