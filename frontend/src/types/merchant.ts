/**
 * Merchant cabinet contract (PLAN 5.5 "Merchant", 5.7). Mirrors the backend DTOs in
 * backend/src/main/java/az/jeparla/merchant/dto. Money and weight stay decimal strings.
 */
import type {
  CheckStatus,
  Decimal,
  IsoDate,
  LocalizedText,
  MetalType,
  PricingMode,
  ProductStatus,
  StockStatus,
  StoneType,
} from "./api";
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
  sellerStatus: SellerStatus;
  /** Backend only (absent in the sample data): the application and the documents check. */
  status?: "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED";
  statusNote?: string | null;
  documentsStatus?: CheckStatus;
  sellerKind?: "PRECIOUS" | "FASHION" | "MIXED";
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
};

export type MerchantProduct = { id: number; status: ProductStatus; input: ProductInput };
