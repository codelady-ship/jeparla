import { z } from "zod";
import { compareDecimal } from "@/lib/pricing";
import { normalizePhone } from "@/lib/seller/schemas";
import { PRODUCT_AUDIENCES } from "@/types/merchant";

/**
 * Product form and store profile (PLAN 5.7), one schema per form step so the
 * wizard checks a step before moving on. Shared by the browser and the route
 * handlers; messages are i18n keys (Merchant.errors, then Sell.errors).
 */

export const MAX_IMAGES = 8;
export const MAX_VARIANTS = 10;
export const MAX_STONES = 6;

const METALS = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"] as const;
const STOCK = ["IN_STOCK", "MADE_TO_ORDER", "OUT_OF_STOCK"] as const;
const STONES = ["DIAMOND", "RUBY", "SAPPHIRE", "EMERALD", "PEARL", "CUBIC_ZIRCONIA"] as const;

/** Decimal as typed ("3,25" or "3.25"), kept as a string: never a float. */
const decimal = (max: number, scale = 3) =>
  z
    .string()
    .trim()
    .min(1, "required")
    .transform((v) => v.replace(",", "."))
    .refine(
      (v) =>
        new RegExp(`^\\d{1,8}(\\.\\d{1,${scale}})?$`).test(v) && Number(v) > 0 && Number(v) <= max,
      "decimalInvalid",
    );

export const imagesStep = z.object({
  images: z
    .array(z.object({ id: z.string(), url: z.string().min(1), name: z.string().max(200) }))
    .min(1, "imagesRequired")
    .max(MAX_IMAGES, "imagesTooMany"),
});

export const basicsStep = z.object({
  name: z.string().trim().min(3, "productNameShort").max(120, "nameLong"),
  category: z.string().min(1, "required"),
  audience: z.enum(PRODUCT_AUDIENCES).default("UNISEX"),
  description: z.string().trim().max(2000, "descriptionLong"),
});

/** Money as typed; checked by checkPricing because it depends on the mode. */
const money = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."));
const isMoney = (v: string, max = 10_000_000) =>
  /^\d{1,8}(\.\d{1,2})?$/.test(v) && Number(v) <= max;

export const variantSchema = z.object({
  key: z.string(),
  size: z.string().trim().max(20, "sizeLong"),
  weightGrams: decimal(10_000),
  /** Required for FIXED; ignored (recomputed daily) for METAL_LINKED. */
  price: money,
  stockStatus: z.enum(STOCK),
});

export const pricingSchema = z.object({
  laborPerGram: money,
  laborFixed: money,
  stonePrice: money,
  markupPercent: money,
  minPrice: money,
  maxPrice: money,
});

const metalShape = {
  metal: z.enum(METALS, "required"),
  fineness: z.string().min(1, "required"),
  pricingMode: z.enum(["FIXED", "METAL_LINKED"]),
  pricing: pricingSchema,
  variants: z.array(variantSchema).min(1, "variantsRequired").max(MAX_VARIANTS, "variantsTooMany"),
};

type MetalValues = z.output<z.ZodObject<typeof metalShape>>;

/**
 * FIXED needs a price on every variant. METAL_LINKED needs the rule (PLAN 5.10):
 * labor and stone are amounts >= 0, markup a percent 0-1000, min/max optional
 * and min not above max.
 */
function checkPricing(v: MetalValues, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  if (v.pricingMode === "FIXED") {
    v.variants.forEach((variant, i) => {
      if (!variant.price) issue(["variants", i, "price"], "required");
      else if (!isMoney(variant.price) || Number(variant.price) <= 0)
        issue(["variants", i, "price"], "decimalInvalid");
    });
    return;
  }
  const p = v.pricing;
  for (const key of ["laborPerGram", "laborFixed", "stonePrice"] as const)
    if (!isMoney(p[key] || "0")) issue(["pricing", key], "moneyInvalid");
  if (!isMoney(p.markupPercent || "0", 1000)) issue(["pricing", "markupPercent"], "percentInvalid");
  for (const key of ["minPrice", "maxPrice"] as const)
    if (p[key] !== "" && (!isMoney(p[key]) || Number(p[key]) <= 0))
      issue(["pricing", key], "decimalInvalid");
  if (
    isMoney(p.minPrice) &&
    isMoney(p.maxPrice) &&
    p.minPrice !== "" &&
    p.maxPrice !== "" &&
    compareDecimal(p.minPrice, p.maxPrice) > 0
  )
    issue(["pricing", "maxPrice"], "maxBelowMin");
}

export const metalStep = z.object(metalShape).superRefine(checkPricing);

export const stoneSchema = z.object({
  key: z.string(),
  type: z.enum(STONES, "required"),
  origin: z.enum(["NATURAL", "LAB_GROWN"]),
  carat: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine(
      (v) => v === "" || (/^\d{1,3}(\.\d{1,3})?$/.test(v) && Number(v) > 0),
      "decimalInvalid",
    ),
  count: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,2}$/, "countInvalid"),
  certificateLab: z.string().trim().max(40, "nameLong"),
  certificateNumber: z.string().trim().max(60, "nameLong"),
});

export const stonesStep = z.object({
  stones: z.array(stoneSchema).max(MAX_STONES, "stonesTooMany"),
});

export const docsStep = z.object({
  docs: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(200),
        size: z.number().int().positive(),
        type: z.string(),
      }),
    )
    .max(5),
});

export const productInput = z
  .object({
    ...imagesStep.shape,
    ...basicsStep.shape,
    ...metalShape,
    ...stonesStep.shape,
    ...docsStep.shape,
  })
  .superRefine(checkPricing);

/**
 * DRAFT keeps the product private; REVIEW sends it to the admin (PLAN 5.9) and
 * needs an approved seller and at least one document.
 */
export const productSubmit = z.object({
  intent: z.enum(["DRAFT", "REVIEW"]),
  product: productInput,
});

export const statusChange = z.object({ status: z.enum(["APPROVED", "INACTIVE"]) });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "storeNameShort").max(80, "nameLong"),
  whatsapp: z
    .string()
    .trim()
    .min(1, "required")
    .refine((v) => normalizePhone(v) !== null, "phoneInvalid"),
  city: z.string().trim().min(1, "required"),
  address: z.string().trim().min(5, "addressShort").max(200, "addressLong"),
  social: z
    .string()
    .trim()
    .max(200, "socialInvalid")
    .refine((v) => v === "" || /^(@[\w.]{2,30}|https:\/\/\S+)$/.test(v), "socialInvalid"),
  description: z.string().trim().max(1000, "descriptionLong"),
  openingHours: z.string().max(200),
  /** Google Maps / Yandex Maps link or "lat, lng" (#116); the backend reads the point, empty keeps it. */
  mapLink: z.string().trim().max(2000, "descriptionLong").optional(),
});

export type ProfileInput = z.input<typeof profileSchema>;

/** Error key per full path, e.g. { "variants.0.price": "decimalInvalid" }. */
export function pathErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "form";
    out[key] ??= issue.message;
  }
  return out;
}
