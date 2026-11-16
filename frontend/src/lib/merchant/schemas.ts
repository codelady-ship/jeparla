import { z } from "zod";
import { compareDecimal } from "@/lib/pricing";
import { normalizePhone } from "@/lib/seller/schemas";
import { STORE_SERVICES } from "@/types/api";
import { FASHION_MATERIALS, PRODUCT_AUDIENCES, SELLER_KINDS } from "@/types/merchant";

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

export const imagesStep = z.object({
  images: z
    .array(z.object({ id: z.string(), url: z.string().min(1), name: z.string().max(200) }))
    .min(1, "imagesRequired")
    .max(MAX_IMAGES, "imagesTooMany"),
});

export const MAX_KEY_FEATURES = 5;
export const KEY_FEATURE_LENGTH = 120;

/** A size in mm as typed (#174): empty, or > 0 with up to 4 digits and 2 decimals. */
const dimension = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."))
  .refine((v) => v === "" || (/^\d{1,4}(\.\d{1,2})?$/.test(v) && Number(v) > 0), "decimalInvalid")
  .optional();

export const basicsStep = z.object({
  dimensions: z
    .object({
      widthMm: dimension,
      thicknessMm: dimension,
      lengthMm: dimension,
      diameterMm: dimension,
    })
    .optional(),
  /** One feature per line as typed; blank lines are dropped when saving. */
  keyFeatures: z
    .array(z.string().max(KEY_FEATURE_LENGTH, "keyFeatureLong"))
    .optional()
    .refine(
      (v) => (v ?? []).filter((f) => f.trim() !== "").length <= MAX_KEY_FEATURES,
      "keyFeaturesTooMany",
    ),
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
  /** Required for PRECIOUS, optional for FASHION (#128); checked by checkMaterial. */
  weightGrams: z
    .string()
    .trim()
    .transform((v) => v.replace(",", ".")),
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
  /** Absent in older drafts: PRECIOUS. */
  materialKind: z.enum(["PRECIOUS", "FASHION"]).optional(),
  /** PRECIOUS only; checked by checkMaterial. */
  metal: z.union([z.enum(METALS), z.literal("")]),
  fineness: z.string(),
  /** FASHION only (#128): the main material and "this is not a precious metal". */
  material: z.union([z.enum(FASHION_MATERIALS), z.literal("")]).optional(),
  notPreciousConfirmed: z.boolean().optional(),
  pricingMode: z.enum(["FIXED", "METAL_LINKED"]),
  pricing: pricingSchema,
  variants: z.array(variantSchema).min(1, "variantsRequired").max(MAX_VARIANTS, "variantsTooMany"),
};

type MetalValues = z.output<z.ZodObject<typeof metalShape>>;

const isWeight = (v: string) =>
  /^\d{1,8}(\.\d{1,3})?$/.test(v) && Number(v) > 0 && Number(v) <= 10_000;

/**
 * PRECIOUS needs metal, fineness and a weight on every variant. FASHION (#128) needs a material,
 * the "not a precious metal" confirmation and a FIXED price; the weight is optional. Then the price.
 */
function checkMaterial(v: MetalValues, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const fashion = v.materialKind === "FASHION";
  if (fashion) {
    if (!v.material) issue(["material"], "required");
    if (!v.notPreciousConfirmed) issue(["notPreciousConfirmed"], "notPreciousRequired");
    if (v.pricingMode !== "FIXED") issue(["pricingMode"], "fashionFixedOnly");
  } else {
    if (!v.metal) issue(["metal"], "required");
    if (!v.fineness) issue(["fineness"], "required");
  }
  v.variants.forEach((variant, i) => {
    if (variant.weightGrams === "") {
      if (!fashion) issue(["variants", i, "weightGrams"], "required");
    } else if (!isWeight(variant.weightGrams))
      issue(["variants", i, "weightGrams"], "decimalInvalid");
  });
  checkPricing(v, ctx);
}

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

export const metalStep = z.object(metalShape).superRefine(checkMaterial);

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

const evidencePhoto = z.object({
  url: z.string().min(1),
  status: z.enum(["NONE", "PENDING", "VERIFIED", "REJECTED"]).optional(),
  checkNote: z.string().max(1000).nullable().optional(),
});

/** Hallmark and label photos (#106); optional for older drafts. */
export const evidenceShape = {
  evidence: z
    .object({ HALLMARK: evidencePhoto.optional(), TAG: evidencePhoto.optional() })
    .optional(),
};

export const productInput = z
  .object({
    ...evidenceShape,
    ...imagesStep.shape,
    ...basicsStep.shape,
    ...metalShape,
    ...stonesStep.shape,
    ...docsStep.shape,
  })
  .superRefine(checkMaterial);

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
  /** What the store sells (#128); absent keeps the stored answer. */
  sellerKind: z.enum(SELLER_KINDS).optional(),
  /** Product page price breakdown (#104): labor and store share as two lines; absent keeps it. */
  splitLaborMarkup: z.boolean().optional(),
  /** The store's own services and return terms (#174); absent keeps them. */
  services: z.array(z.enum(STORE_SERVICES)).optional(),
  returnPolicy: z.string().trim().max(500, "returnPolicyLong").optional(),
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
