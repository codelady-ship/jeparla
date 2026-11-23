import { z } from "zod";
import { PASSWORD_MIN } from "@/lib/auth/schemas";

/**
 * Seller sign-up (PLAN 5.6), one schema per wizard step. Shared by the browser
 * and the route handler; messages are i18n keys (Sell.errors, then Auth.errors).
 */

/** Azerbaijani mobile operators; stored as +994XXXXXXXXX. */
const MOBILE_CODES = ["10", "50", "51", "55", "60", "70", "77", "99"];

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("994")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  if (local.length !== 9 || !MOBILE_CODES.includes(local.slice(0, 2))) return null;
  return `+994${local}`;
}

const phone = z
  .string()
  .trim()
  .min(1, "required")
  .refine((v) => normalizePhone(v) !== null, "phoneInvalid");

/** Decimal as typed ("3,25" or "3.25"), kept as a string: never a float. */
const decimal = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "required")
    .transform((v) => v.replace(",", "."))
    .refine(
      (v) => /^\d{1,7}(\.\d{1,3})?$/.test(v) && Number(v) > 0 && Number(v) <= max,
      "decimalInvalid",
    );

export const accountStep = z.object({
  name: z.string().trim().min(2, "nameShort").max(80, "nameLong"),
  phone,
  password: z
    .string()
    .min(PASSWORD_MIN, "passwordShort")
    .max(128, "passwordLong")
    .regex(/\p{L}/u, "passwordLetter")
    .regex(/\d/, "passwordDigit"),
});

export const LEGAL_TYPES = ["COMPANY", "SOLE_TRADER"] as const;

export const storeStep = z
  .object({
    storeName: z.string().trim().min(2, "storeNameShort").max(80, "nameLong"),
    whatsapp: phone,
    city: z.string().trim().min(1, "required"),
    address: z.string().trim().min(5, "addressShort").max(200, "addressLong"),
    social: z
      .string()
      .trim()
      .max(200, "socialInvalid")
      .refine((v) => v === "" || /^(@[\w.]{2,30}|https:\/\/\S+)$/.test(v), "socialInvalid"),
    legalType: z.enum(LEGAL_TYPES, "required"),
    /**
     * "Do you sell official jewellery (gold, silver, platinum, diamonds)?" (#128): PRECIOUS, FASHION
     * (bijouterie and handmade, no documents) or MIXED. Older drafts without it read as PRECIOUS.
     */
    sellerKind: z.enum(["PRECIOUS", "FASHION", "MIXED"], "required").default("PRECIOUS"),
    /**
     * VOEN: 10 digits, the same for companies and sole traders. Optional for a bijouterie or
     * handmade seller (#317), required when the store sells precious jewellery (checked below).
     */
    taxId: z
      .string()
      .trim()
      .regex(/^(\d{10})?$/, "taxIdInvalid"),
    /** The seller code of conduct (#107, /verified#code) must be accepted to apply. */
    codeAccepted: z.boolean().refine((v) => v, "codeRequired"),
  })
  .refine((s) => s.taxId !== "" || !taxIdRequired(s.sellerKind), {
    message: "taxIdInvalid",
    path: ["taxId"],
  });

/** Same rule as the backend (StoreRequest): only a bijouterie-only seller may leave the VOEN out. */
export function taxIdRequired(sellerKind: string | undefined): boolean {
  return sellerKind !== "FASHION";
}

export const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
export const DOC_MAX_COUNT = 5;

export const docSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  size: z.number().int().positive().max(DOC_MAX_BYTES),
  type: z.enum(DOC_TYPES),
});

export const docsStep = z.object({
  docs: z.array(docSchema).max(DOC_MAX_COUNT),
});

/** Optional; when the seller fills it in, every field is checked. */
export const productStep = z.object({
  productName: z.string().trim().min(3, "productNameShort").max(120, "nameLong"),
  category: z.string().min(1, "required"),
  fineness: z.string().min(1, "required"),
  weight: decimal(10_000),
  price: decimal(10_000_000),
});

/**
 * Step 4 photos (#317), downscaled in the browser to JPEG data URLs (lib/merchant/images) so
 * they fit in the draft. They are uploaded right after the account and store exist: onto the
 * first product, or as photo drafts in the cabinet when there is no product (bijouterie).
 */
export const PHOTO_MAX_COUNT = 4;
/** A 960 px JPEG is far below this; it only stops an oversized request. */
const PHOTO_MAX_URL = 4 * 1024 * 1024;

export const signupPhoto = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  url: z
    .string()
    .max(PHOTO_MAX_URL)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
});

export const sellerSignup = z.object({
  account: accountStep,
  store: storeStep,
  docs: docsStep,
  product: productStep.nullable(),
  photos: z.array(signupPhoto).max(PHOTO_MAX_COUNT).default([]),
});

export type AccountStep = z.input<typeof accountStep>;
export type StoreStep = z.input<typeof storeStep>;
export type DocMeta = z.infer<typeof docSchema>;
export type ProductStep = z.input<typeof productStep>;
export type SignupPhoto = z.infer<typeof signupPhoto>;
