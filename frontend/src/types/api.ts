/**
 * Jeparla API contract (frontend side). The Spring Boot DTOs in
 * backend/src/main/java/az/jeparla/<feature>/dto mirror these names one to one
 * (PLAN 5.2 and 5.5). Change both sides in the same PR.
 *
 * Money and weight are decimal strings ("1248.50", "3.250"), never JS numbers:
 * they come from PostgreSQL NUMERIC / Java BigDecimal and stay exact.
 */

/** Decimal number serialized as a string, e.g. "1248.50". */
export type Decimal = string;
/** ISO 8601 date ("2026-11-03") or date-time ("2026-11-03T10:00:00+04:00"). */
export type IsoDate = string;

export type Currency = "AZN" | "USD" | "EUR";
export type Money = { amount: Decimal; currency: Currency };

export type LocalizedText = { az: string; en: string; ru: string };

export type MetalType = "GOLD" | "SILVER" | "PLATINUM" | "PALLADIUM";
export type PricingMode = "FIXED" | "METAL_LINKED";
/**
 * PRECIOUS: gold, silver, platinum, diamonds (metal, fineness, weight, certificates). FASHION: bijouterie
 * and handmade (#128): no metal and no fineness, a material instead, FIXED prices, no certificates.
 */
export type MaterialKind = "PRECIOUS" | "FASHION";
export type FashionMaterial =
  | "BEADS"
  | "STAINLESS_STEEL"
  | "COPPER"
  | "BRASS"
  | "SILVER_PLATED"
  | "GOLD_PLATED"
  | "LEATHER"
  | "TEXTILE"
  | "WOOD"
  | "GLASS"
  | "CERAMIC"
  | "RESIN"
  | "NATURAL_STONE"
  | "OTHER";
export type StockStatus = "IN_STOCK" | "MADE_TO_ORDER" | "OUT_OF_STOCK";
export type ProductStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "RETURNED" | "INACTIVE";

/** Each Jeparla Verified check is separate (PLAN 5.9). */
export type CheckStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";
export type Verification = {
  seller: CheckStatus;
  documents: CheckStatus;
  expertise: CheckStatus;
};

export type Fineness = {
  id: number;
  metal: MetalType;
  /** Parts per thousand: 375, 585, 750, 916, 999, 925 ... */
  value: number;
  label: string;
};

export type Category = {
  id: number;
  slug: string;
  parentId: number | null;
  name: LocalizedText;
  productCount: number;
};

export type StoreSummary = {
  id: number;
  slug: string;
  name: string;
  city: string;
  logoUrl: string | null;
  verification: Verification;
  productCount: number;
};

export type Store = StoreSummary & {
  description: LocalizedText;
  address: string;
  /** E.164, used for the WhatsApp link. */
  whatsapp: string;
  phone: string;
  openingHours: string;
  geo: { lat: Decimal; lng: Decimal } | null;
  createdAt: IsoDate;
};

export type ProductImage = {
  url: string;
  alt: LocalizedText;
  width: number;
  height: number;
  /** AI-generated or AI-edited images must carry a visible label (CLAUDE.md, honesty). */
  aiGenerated: boolean;
};

export type StoneType = "DIAMOND" | "RUBY" | "SAPPHIRE" | "EMERALD" | "PEARL" | "CUBIC_ZIRCONIA";
export type Stone = {
  type: StoneType;
  origin: "NATURAL" | "LAB_GROWN";
  shape: string | null;
  carat: Decimal | null;
  color: string | null;
  clarity: string | null;
  cut: string | null;
  count: number;
  certificateLab: string | null;
  certificateNumber: string | null;
};

/** METAL_LINKED inputs (PLAN 5.10). Absent for FIXED variants. */
export type PricingRule = {
  laborPerGram: Decimal;
  laborFixed: Decimal;
  stonePrice: Decimal;
  markupPercent: Decimal;
  minPrice: Decimal | null;
  maxPrice: Decimal | null;
};

export type Variant = {
  id: number;
  sku: string;
  fineness: Fineness;
  weightGrams: Decimal;
  size: string | null;
  price: Money;
  pricingMode: PricingMode;
  pricing: PricingRule | null;
  stockStatus: StockStatus;
  priceUpdatedAt: IsoDate;
};

/** What lists, grids and search results need. */
export type ProductSummary = {
  id: number;
  slug: string;
  name: LocalizedText;
  categoryId: number;
  store: Pick<StoreSummary, "id" | "slug" | "name" | "city" | "verification">;
  /** FASHION products (#128) are shown in their own section with a badge, never with a metal price block. */
  materialKind: MaterialKind;
  /** FASHION only. */
  material: FashionMaterial | null;
  /**
   * The demo catalog is precious only; the API sends null for FASHION. The FASHION UI (#128) widens this
   * to `MetalType | null` together with fineness and weightGrams.
   */
  metal: MetalType;
  /** Lowest variant price. */
  priceFrom: Money;
  /** The variant priceFrom comes from; the compare button on a card adds this one. */
  defaultVariantId: number;
  pricingMode: PricingMode;
  fineness: number;
  weightGrams: Decimal;
  images: ProductImage[];
  hasStones: boolean;
  verification: Verification;
  stockStatus: StockStatus;
  publishedAt: IsoDate;
};

export type Product = ProductSummary & {
  description: LocalizedText;
  variants: Variant[];
  stones: Stone[];
  status: ProductStatus;
};

/** One column of /compare: comparison is per variant (weight, fineness, price differ). */
export type CompareItem = {
  product: ProductSummary;
  variant: Variant;
  stones: Stone[];
};

export type MetalPrice = {
  metal: MetalType;
  /** Business date of the CBAR quote; weekends keep the last available date. */
  date: IsoDate;
  pricePerOunce: Decimal;
  pricePerGram: Decimal;
  currency: "AZN";
  source: "CBAR";
  fetchedAt: IsoDate;
};

/** Spring Data style page. `page` is zero-based. */
export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type ProductSort = "relevance" | "newest" | "price_asc" | "price_desc" | "weight_asc";

/** Query params of GET /api/v1/products (PLAN 5.5). */
export type ProductFilters = {
  q?: string;
  category?: string;
  store?: string[];
  metal?: MetalType;
  fineness?: number[];
  minWeight?: Decimal;
  maxWeight?: Decimal;
  minPrice?: Decimal;
  maxPrice?: Decimal;
  verified?: boolean;
  inStock?: boolean;
  city?: string;
  /** "Bijouterie and handmade" section (FASHION) or precious only (#128). */
  kind?: MaterialKind;
  /** Diamond filters (PLAN 5.4); match products with at least one such stone. */
  shape?: string[];
  minCarat?: Decimal;
  maxCarat?: Decimal;
  color?: string[];
  clarity?: string[];
  sort?: ProductSort;
  page?: number;
  size?: number;
};

export type SearchType = "all" | "products" | "stores" | "categories";

export type SearchResult = {
  query: string;
  products: Page<ProductSummary>;
  stores: StoreSummary[];
  categories: Category[];
};

/** Grouped autocomplete (PLAN 5.3), up to 5 per group. */
export type Suggestions = {
  query: string;
  stores: Pick<StoreSummary, "slug" | "name" | "city">[];
  categories: Pick<Category, "slug" | "name">[];
  products: Pick<ProductSummary, "slug" | "name" | "priceFrom">[];
};
