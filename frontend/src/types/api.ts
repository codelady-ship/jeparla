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
/** Who a piece is for (#121). */
export type Audience = "WOMEN" | "MEN" | "KIDS" | "UNISEX";
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
  /** schema.org openingHours ("Mo-Sa 10:00-20:00"); empty when the store has not filled it in. */
  openingHours: string;
  /** The store's public map point (#116); null until the seller sets it. */
  geo: { lat: Decimal; lng: Decimal } | null;
  /** Kilometres from the `near` point, 0.1 km; only in a list asked with `near`. */
  distanceKm?: Decimal;
};

export type Store = StoreSummary & {
  description: LocalizedText;
  address: string;
  /** E.164, used for the WhatsApp link. */
  whatsapp: string;
  phone: string;
  createdAt: IsoDate;
  /** Day (YYYY-MM-DD, Baku) the store last accepted the seller code (#107); absent if not valid. */
  codeAcceptedOn?: string;
  /** What the store says it offers (#174): its own statement, not a Jeparla guarantee; absent when none. */
  services?: StoreServiceKind[];
  /** The store's return terms in its own words (#174); absent when none. */
  returnPolicy?: string;
  /** Made to order as the store declares it (#108); absent when not declared. */
  madeToOrder?: MadeToOrder | null;
};

/** The store's own answer (#108): days only with offered = true. */
export type MadeToOrder = { offered: boolean; days: number | null };

export const STORE_SERVICES = ["RESIZE", "ENGRAVING", "GIFT_WRAP", "DELIVERY", "RETURNS"] as const;
export type StoreServiceKind = (typeof STORE_SERVICES)[number];

/** Sizes of a piece in millimetres (#174); a size the seller did not enter is null. */
export type Dimensions = {
  widthMm: Decimal | null;
  thicknessMm: Decimal | null;
  lengthMm: Decimal | null;
  diameterMm: Decimal | null;
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
  /** Null for FASHION (#128). */
  fineness: Fineness | null;
  /** A FASHION variant may have no weight. */
  weightGrams: Decimal | null;
  size: string | null;
  price: Money;
  pricingMode: PricingMode;
  pricing: PricingRule | null;
  stockStatus: StockStatus;
  priceUpdatedAt: IsoDate;
  /**
   * How the price is made up (#104), from the backend PricingEngine. The demo mock does not send it
   * (the contract keeps it in BACKEND_AHEAD), so the product page treats it as optional.
   */
  priceBreakdown?: VariantPriceBreakdown;
};

/** `Variant.priceBreakdown` (#104): only the parts the data holds; a missing part is null, never a guess. */
export type VariantPriceBreakdown = {
  /** Always the variant price (the same value as `Variant.price` and the JSON-LD offer). */
  total: Money;
  metal: {
    value: Money;
    weightGrams: Decimal;
    fineness: number;
    /** AZN per gram of pure metal of the quote, 4 decimals. */
    gramPrice: Money;
    quoteDate: IsoDate;
    source: "CBAR" | "ADMIN";
  } | null;
  labor: { amount: Money; perGram: Money | null; fixed: Money | null } | null;
  /** The seller's stone price: there is no official source. */
  stone: Money | null;
  markup: { percent: Decimal; amount: Money } | null;
  clamped: "MIN" | "MAX" | null;
  pricePerGram: Money | null;
  /** The store's choice (#104): labor and markup as two lines; false or absent: one line. */
  laborSeparate?: boolean;
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
  /** Null for FASHION (#128). */
  metal: MetalType | null;
  /** Lowest variant price. */
  priceFrom: Money;
  /** The variant priceFrom comes from; the compare button on a card adds this one. */
  defaultVariantId: number;
  pricingMode: PricingMode;
  /** Null for FASHION (#128). */
  fineness: number | null;
  /** A FASHION product may have no weight. */
  weightGrams: Decimal | null;
  images: ProductImage[];
  hasStones: boolean;
  verification: Verification;
  stockStatus: StockStatus;
  publishedAt: IsoDate;
};

/** A hallmark or label photo the seller added (#106); not a laboratory assay. */
export type EvidencePhoto = {
  kind: "HALLMARK" | "TAG";
  url: string;
  width: number;
  height: number;
  /** An admin compared it with the product data and found it matching. */
  checked: boolean;
};

export type Product = ProductSummary & {
  description: LocalizedText;
  variants: Variant[];
  stones: Stone[];
  status: ProductStatus;
  /** HALLMARK first; the demo mock does not send it (contract BACKEND_AHEAD). */
  evidencePhotos?: EvidencePhoto[];
  /** Sizes in mm (#174); absent when the seller entered none. */
  dimensions?: Dimensions | null;
  /** Up to 5 key features the seller wrote (#174); absent when none. */
  keyFeatures?: string[];
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
  /** CBAR: the daily bulletin; ADMIN: a manual correction by a Jeparla admin (#150). */
  source: "CBAR" | "ADMIN";
  fetchedAt: IsoDate;
};

/** Currencies a price can be shown in besides AZN (#53); display only. */
export type DisplayCurrency = "USD" | "EUR";

/** CBAR rate of a display currency: AZN per one unit (#53). */
export type ExchangeRate = {
  currency: DisplayCurrency;
  /** CBAR bulletin date. */
  date: IsoDate;
  aznPerUnit: Decimal;
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
  /** Only products with a hallmark photo (#106). */
  hallmarkPhoto?: boolean;
  inStock?: boolean;
  city?: string;
  /** "Bijouterie and handmade" section (FASHION) or precious only (#128). */
  kind?: MaterialKind;
  /** Who the piece is for (#121): WOMEN and MEN also match UNISEX pieces. */
  audience?: Audience;
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
/** GET /api/v1/search/image/status (#163). */
export type ImageSearchStatus = { configured: boolean; maxBytes: number };

/** Error codes of POST /api/v1/search/image. */
export const IMAGE_SEARCH_ERRORS = [
  "search.image_not_configured",
  "search.image_size",
  "search.image_type",
  "search.image_unreadable",
  "rate_limited",
] as const;
export type ImageSearchError = (typeof IMAGE_SEARCH_ERRORS)[number];

/** POST /api/v1/search/image: products most similar first (no score, honesty rule). */
export type ImageSearchResult =
  { ok: true; products: ProductSummary[] } | { ok: false; error: ImageSearchError };

export type Suggestions = {
  query: string;
  stores: Pick<StoreSummary, "slug" | "name" | "city">[];
  categories: Pick<Category, "slug" | "name">[];
  products: Pick<ProductSummary, "slug" | "name" | "priceFrom">[];
};
