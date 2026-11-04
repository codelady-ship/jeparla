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
  ProductStatus,
  StockStatus,
  StoneType,
} from "./api";

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
};

export type MerchantDashboard = {
  /** Last 30 days. */
  views: number;
  whatsappClicks: number;
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
  priceFrom: Decimal;
  variantCount: number;
  views: number;
  updatedAt: IsoDate;
  /** Admin note when the product came back (RETURNED). */
  reviewNote: string | null;
};

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

/** What the product form edits; also the body of POST/PUT /api/v1/merchant/products. */
export type ProductInput = {
  images: ProductImageInput[];
  name: string;
  category: string;
  description: string;
  metal: MetalType | "";
  fineness: string;
  variants: VariantInput[];
  stones: StoneInput[];
  docs: { id: string; name: string; size: number; type: string }[];
};

export type MerchantProduct = { id: number; status: ProductStatus; input: ProductInput };
