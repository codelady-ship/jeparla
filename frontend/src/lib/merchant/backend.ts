import type {
  Category,
  CheckStatus,
  FashionMaterial,
  Money,
  ProductStatus,
  StockStatus,
  Stone,
} from "@/types/api";
import type {
  EvidenceKind,
  EvidenceInput,
  MerchantProduct,
  ProductAudience,
  ProductInput,
} from "@/types/merchant";
import { suggestAudience } from "./audience";
import { EMPTY_PRICING } from "./draft";

/**
 * Merchant cabinet against the backend (PLAN 5.5, backend/README.md "Satıcı API"):
 * the DTOs as the API sends them and the mapping to and from the product form.
 * Pure functions; the calls themselves are in lib/api/merchant.ts and the route handlers.
 */

export type BackendVariant = {
  id: number;
  sku: string;
  finenessId: number | null;
  weightGrams: string | null;
  size: string | null;
  price: Money;
  pricingMode: "FIXED" | "METAL_LINKED";
  rule: {
    laborPerGram: string;
    laborFixed: string;
    stonePrice: string;
    markupPercent: string;
    minPrice: string | null;
    maxPrice: string | null;
  } | null;
  stockStatus: StockStatus;
};

export type BackendImage = { id: number; url: string; sortOrder: number };

export type BackendProduct = {
  id: number;
  slug: string;
  status: ProductStatus;
  reviewNote: string | null;
  materialKind: "PRECIOUS" | "FASHION";
  categoryId: number;
  name: { az: string; en: string | null; ru: string | null };
  description: { az: string | null; en: string | null; ru: string | null } | null;
  metal: string | null;
  /** FASHION only (#128). */
  material?: FashionMaterial | null;
  notPreciousConfirmedAt?: string | null;
  images: BackendImage[];
  variants: BackendVariant[];
  stones: Stone[];
  /** Who the piece is for (#121); older answers may not have it. */
  audience?: ProductAudience | null;
  /** Hallmark and label photos (#106), with the admin check. */
  evidencePhotos?: BackendEvidencePhoto[];
};

export type BackendEvidencePhoto = {
  id: number;
  kind: EvidenceKind;
  url: string;
  status: CheckStatus;
  checkNote: string | null;
};

export type ImageUpload = {
  key: string;
  url: string;
  method: string;
  headers: Record<string, string>;
};

/** Form id of a photo that is already stored: `img<backend id>`. */
export const storedImageId = (id: number) => `img${id}`;
/** Form id of a photo taken over from a draft (#109): "draft<id>". */
export const draftImageFormId = (draftId: number) => `draft${draftId}`;

export const draftImageId = (formId: string) => {
  const m = /^draft(\d+)$/.exec(formId);
  return m ? Number(m[1]) : null;
};

export const backendImageId = (formId: string) => {
  const m = /^img(\d+)$/.exec(formId);
  return m ? Number(m[1]) : null;
};

export function toProductInput(p: BackendProduct, categories: Category[]): ProductInput {
  const first = p.variants[0];
  const rule = p.variants.find((v) => v.rule)?.rule;
  return {
    images: [...p.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({ id: storedImageId(img.id), url: img.url, name: img.url })),
    name: p.name.az,
    category: categories.find((c) => c.id === p.categoryId)?.slug ?? "",
    audience: p.audience ?? suggestAudience(p.categoryId, categories),
    description: p.description?.az ?? "",
    metal: (p.metal ?? "") as ProductInput["metal"],
    fineness: first?.finenessId ? String(first.finenessId) : "",
    pricingMode: first?.pricingMode ?? "FIXED",
    pricing: rule
      ? {
          laborPerGram: rule.laborPerGram,
          laborFixed: rule.laborFixed,
          stonePrice: rule.stonePrice,
          markupPercent: rule.markupPercent,
          minPrice: rule.minPrice ?? "",
          maxPrice: rule.maxPrice ?? "",
        }
      : { ...EMPTY_PRICING },
    variants: p.variants.map((v) => ({
      key: `v${v.id}`,
      size: v.size ?? "",
      weightGrams: v.weightGrams ?? "",
      price: v.price.amount,
      stockStatus: v.stockStatus,
    })),
    stones: p.stones.map((s, i) => ({
      key: `s${i}`,
      type: s.type,
      origin: s.origin,
      carat: s.carat ?? "",
      count: String(s.count),
      certificateLab: s.certificateLab ?? "",
      certificateNumber: s.certificateNumber ?? "",
    })),
    // Expertise documents are separate, private uploads (lib/api/merchant documents).
    docs: [],
    materialKind: p.materialKind,
    material: p.material ?? "",
    notPreciousConfirmed: p.materialKind === "FASHION" && Boolean(p.notPreciousConfirmedAt),
    evidence: Object.fromEntries(
      (p.evidencePhotos ?? []).map((e): [EvidenceKind, EvidenceInput] => [
        e.kind,
        { url: e.url, status: e.status, checkNote: e.checkNote },
      ]),
    ),
  };
}

export const toMerchantProduct = (p: BackendProduct, categories: Category[]): MerchantProduct => ({
  id: p.id,
  status: p.status,
  input: toProductInput(p, categories),
});

const blank = (v: string) => (v.trim() === "" ? null : v.trim());

/**
 * Body of POST/PUT /merchant/products. Translations the form does not edit (name and
 * description in en/ru) and variant SKUs are kept from the stored product.
 */
export function toProductRequest(
  input: ProductInput,
  categories: Category[],
  existing: BackendProduct | null,
) {
  const kind = input.materialKind ?? existing?.materialKind ?? "PRECIOUS";
  const fashion = kind === "FASHION";
  // Bijouterie (#128): material instead of metal and fineness, FIXED prices only.
  const linked = !fashion && input.pricingMode === "METAL_LINKED";
  const known = new Map(existing?.variants.map((v) => [v.id, v]) ?? []);
  return {
    materialKind: kind,
    categoryId: categories.find((c) => c.slug === input.category)?.id ?? null,
    audience: input.audience,
    name: { az: input.name.trim(), en: existing?.name.en ?? null, ru: existing?.name.ru ?? null },
    description: {
      az: blank(input.description),
      en: existing?.description?.en ?? null,
      ru: existing?.description?.ru ?? null,
    },
    metal: fashion ? null : input.metal || null,
    material: fashion ? input.material || null : null,
    notPreciousConfirmed: fashion ? input.notPreciousConfirmed === true : null,
    variants: input.variants.map((v) => {
      const id = /^v(\d+)$/.exec(v.key) ? Number(v.key.slice(1)) : null;
      const stored = id !== null ? known.get(id) : undefined;
      return {
        ...(stored && { id: stored.id, sku: stored.sku }),
        finenessId: fashion ? null : Number(input.fineness),
        weightGrams: blank(v.weightGrams.replace(",", ".")),
        size: blank(v.size),
        pricingMode: linked ? "METAL_LINKED" : "FIXED",
        price: linked ? null : v.price.replace(",", "."),
        rule: linked
          ? {
              laborPerGram: input.pricing.laborPerGram.replace(",", "."),
              laborFixed: input.pricing.laborFixed.replace(",", "."),
              stonePrice: input.pricing.stonePrice.replace(",", "."),
              markupPercent: input.pricing.markupPercent.replace(",", "."),
              minPrice: blank(input.pricing.minPrice.replace(",", ".")),
              maxPrice: blank(input.pricing.maxPrice.replace(",", ".")),
            }
          : null,
        stockStatus: v.stockStatus,
      };
    }),
    stones: input.stones.map((s) => ({
      type: s.type,
      origin: s.origin,
      carat: blank(s.carat.replace(",", ".")),
      count: Number(s.count),
      certificateLab: blank(s.certificateLab),
      certificateNumber: blank(s.certificateNumber),
    })),
  };
}

/** A photo the form holds as a data: URL (new, not uploaded yet): its bytes and type. */
export function dataUrlBytes(url: string): { type: string; bytes: Uint8Array } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(url);
  if (!m) return null;
  return { type: m[1], bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) };
}
