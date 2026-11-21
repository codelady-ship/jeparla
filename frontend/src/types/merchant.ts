/**
 * Merchant cabinet contract (PLAN 5.5 "Merchant", 5.7). Mirrors the backend DTOs in
 * backend/src/main/java/az/jeparla/merchant/dto. Money and weight stay decimal strings.
 */
import type {
  CheckStatus,
  Decimal,
  FashionMaterial,
  IsoDate,
  LocalizedText,
  MadeToOrder,
  MetalType,
  PricingMode,
  ProductStatus,
  StockStatus,
  StoneType,
  StoreServiceKind,
} from "./api";
import type { MerchantVideo } from "@/lib/merchant/video";
import type { ContactQuestion } from "@/lib/whatsapp";

/** Seller check (PLAN 5.9): only an APPROVED seller can send products to review. */
export type SellerStatus = CheckStatus;

export type MerchantStore = {
  id: number;
  slug: string;
  name: string;
  city: string;
  address: string;
  whatsapp: string;
  social: string;
  description: string;
  /** schema.org openingHours, e.g. "Mo-Fr 10:00-19:00; Sa 11:00-17:00". */
  openingHours: string;
  /** The store's map point for "near me" (#116); null or absent until the seller sets it. */
  geo?: { lat: Decimal; lng: Decimal } | null;
  sellerStatus: SellerStatus;
  /** Backend only (absent in the sample data): the application and the documents check. */
  status?: "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED";
  statusNote?: string | null;
  documentsStatus?: CheckStatus;
  sellerKind?: SellerKind;
  /** Backend only: the price breakdown shows labor and store share as two lines (#104). */
  splitLaborMarkup?: boolean;
  /** Backend only (#174): the store's own services and return terms. */
  services?: StoreServiceKind[];
  returnPolicy?: string;
  /** Backend only (#108): made to order as the store declares it; null when not declared. */
  madeToOrder?: MadeToOrder | null;
  /** Backend only (#249): the registered name for the store page; empty when not provided. */
  legalName?: string;
  /** Backend only: seller code of conduct version to accept (#107) and the last acceptance. */
  codeVersion?: number;
  codeAcceptedAt?: string | null;
  /** A year after the acceptance; after it products cannot go to review. */
  codeValidUntil?: string | null;
};

export type MerchantDashboard = {
  /** Last 30 days; null while views are not counted (never an invented number). */
  views: number | null;
  whatsappClicks: number;
  /** The same clicks per ready question (#111); absent in the sample data (no invented split). */
  whatsappClicksByQuestion?: Record<ContactQuestion, number>;
  counts: Record<ProductStatus, number>;
};

/** One row of /merchant/products. */
export type MerchantProductRow = {
  id: number;
  slug: string;
  name: LocalizedText;
  imageUrl: string | null;
  categoryId: number;
  status: ProductStatus;
  priceFrom: Decimal | null;
  variantCount: number;
  views: number | null;
  updatedAt: IsoDate;
  /** Backend only: bijouterie (FASHION) needs no documents. */
  materialKind?: "PRECIOUS" | "FASHION";
  /** Admin note when the product came back (RETURNED). */
  reviewNote: string | null;
};

/** Who a piece is for (#121): picks the AI model of an on-model image. */
export const PRODUCT_AUDIENCES = ["UNISEX", "WOMEN", "MEN", "KIDS"] as const;
export type ProductAudience = (typeof PRODUCT_AUDIENCES)[number];

export type ProductImageInput = {
  id: string;
  /** Uploaded URL, or a downscaled data: URL while the backend does not exist. */
  url: string;
  name: string;
};

export type VariantInput = {
  key: string;
  size: string;
  weightGrams: string;
  price: string;
  stockStatus: StockStatus;
};

export type StoneInput = {
  key: string;
  type: StoneType | "";
  origin: "NATURAL" | "LAB_GROWN";
  carat: string;
  count: string;
  certificateLab: string;
  certificateNumber: string;
};

/** METAL_LINKED inputs as typed; empty min/max means no limit. */
export type PricingInput = {
  laborPerGram: string;
  laborFixed: string;
  stonePrice: string;
  markupPercent: string;
  minPrice: string;
  maxPrice: string;
};

/** Hallmark (fineness stamp) and label photos of a product (#106). */
export const EVIDENCE_KINDS = ["HALLMARK", "TAG"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type EvidenceInput = {
  /** Stored URL, or a downscaled data: URL that is uploaded when the form is saved. */
  url: string;
  /** Stored photos only: PENDING until an admin compared it with the product data. */
  status?: CheckStatus;
  /** The admin's reason for REJECTED (or an optional note). */
  checkNote?: string | null;
};

/** PRECIOUS: gold, silver, platinum (documents, fineness). FASHION: bijouterie (#128). */
export type MaterialKind = "PRECIOUS" | "FASHION";

/** Main material of a bijouterie product; values of backend `FashionMaterial`. */
export const FASHION_MATERIALS = [
  "BEADS",
  "STAINLESS_STEEL",
  "COPPER",
  "BRASS",
  "SILVER_PLATED",
  "GOLD_PLATED",
  "LEATHER",
  "TEXTILE",
  "WOOD",
  "GLASS",
  "CERAMIC",
  "RESIN",
  "NATURAL_STONE",
  "OTHER",
] as const satisfies readonly FashionMaterial[];

/** What the store sells (#128): asked in the seller wizard, changeable in the profile. */
export const SELLER_KINDS = ["PRECIOUS", "FASHION", "MIXED"] as const;
export type SellerKind = (typeof SELLER_KINDS)[number];

export const DIMENSION_KEYS = ["widthMm", "thicknessMm", "lengthMm", "diameterMm"] as const;
export type DimensionsInput = Partial<Record<(typeof DIMENSION_KEYS)[number], string>>;

/** What the product form edits; also the body of POST/PUT /api/v1/merchant/products. */
export type ProductInput = {
  images: ProductImageInput[];
  name: string;
  category: string;
  audience: ProductAudience;
  description: string;
  metal: MetalType | "";
  fineness: string;
  /**
   * One mode and rule for the whole product in the form; the API stores them on
   * every variant (PLAN 5.10 prices per variant), each with its own weight.
   */
  pricingMode: PricingMode;
  pricing: PricingInput;
  variants: VariantInput[];
  stones: StoneInput[];
  docs: { id: string; name: string; size: number; type: string }[];
  /** Absent in older drafts: the stored product's kind (or PRECIOUS) is kept. */
  materialKind?: MaterialKind;
  /** FASHION only (#128): the main material instead of metal and fineness. */
  material?: FashionMaterial | "";
  /** FASHION only: the seller confirms "this is not a precious metal". */
  notPreciousConfirmed?: boolean;
  /** Sizes in mm as typed (#174), each optional; absent in older drafts. */
  dimensions?: DimensionsInput;
  /** Up to 5 key features (#174), one per line as typed; absent in older drafts. */
  keyFeatures?: string[];
  /** Hallmark and label photos (#106); absent in older drafts. */
  evidence?: Partial<Record<EvidenceKind, EvidenceInput>>;
  /**
   * Occasion collections (#115) by id; absent in older drafts, then the stored tags are kept.
   * May hold hidden ones the product already had: the API keeps those.
   */
  collectionIds?: number[];
};

export type MerchantProduct = {
  id: number;
  status: ProductStatus;
  input: ProductInput;
  /** The short video (#117); it is uploaded on its own, not with the form. */
  video?: MerchantVideo | null;
};
