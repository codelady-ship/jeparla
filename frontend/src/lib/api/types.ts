import type {
  Category,
  CompareItem,
  ExchangeRate,
  Fineness,
  ImageSearchResult,
  ImageSearchStatus,
  MetalPrice,
  MetalType,
  OccasionCollection,
  Page,
  Product,
  ProductFilters,
  ProductSummary,
  SearchResult,
  SearchType,
  Store,
  StoreSummary,
  Suggestions,
} from "@/types/api";
import type { StoreFacts, StorePreview } from "@/types/share";

/**
 * Everything pages read goes through this interface. Method names follow the
 * public REST endpoints (PLAN 5.5); the comment on each is the endpoint.
 * `null` means 404.
 */
export interface JeparlaApi {
  /** GET /api/v1/products */
  listProducts(filters?: ProductFilters): Promise<Page<ProductSummary>>;
  /** GET /api/v1/products?ids= (favorites); unknown or hidden ids are left out. */
  getProductsByIds(ids: number[]): Promise<ProductSummary[]>;
  /** GET /api/v1/variants?ids= (compare), in the order asked. */
  getCompareItems(variantIds: number[]): Promise<CompareItem[]>;
  /** GET /api/v1/products/{slug} */
  getProduct(slug: string): Promise<Product | null>;
  /** GET /api/v1/categories */
  listCategories(): Promise<Category[]>;
  /** GET /api/v1/collections (#115): shown occasion collections in the admin order. */
  listCollections(): Promise<OccasionCollection[]>;
  /** GET /api/v1/finenesses */
  listFinenesses(): Promise<Fineness[]>;
  /**
   * GET /api/v1/stores. With `near` ("lat,lng"), stores with a location come first,
   * nearest first, with `distanceKm`; the rest follow in the usual order.
   */
  listStores(params?: { q?: string; city?: string; near?: string }): Promise<StoreSummary[]>;
  /** GET /api/v1/stores/{slug} */
  getStore(slug: string): Promise<Store | null>;
  /** GET /api/v1/stores/{slug}/facts (#108): measured trust facts; null when the store is not public. */
  getStoreFacts(slug: string): Promise<StoreFacts | null>;
  /** GET /api/v1/stores/{slug}/preview (#100): what a link preview shows. */
  getStorePreview(slug: string): Promise<StorePreview | null>;
  /** GET /api/v1/stores/{slug}/products */
  listStoreProducts(slug: string, filters?: ProductFilters): Promise<Page<ProductSummary>>;
  /** GET /api/v1/search */
  search(q: string, type?: SearchType, page?: number): Promise<SearchResult>;
  /** GET /api/v1/search/suggest */
  suggest(q: string): Promise<Suggestions>;
  /** GET /api/v1/search/image/status (#163) */
  imageSearchStatus(): Promise<ImageSearchStatus>;
  /** POST /api/v1/search/image (#163): the photo is never stored. */
  searchByImage(image: Blob, filters?: [string, string][]): Promise<ImageSearchResult>;
  /** GET /api/v1/metal-prices/latest */
  latestMetalPrices(): Promise<MetalPrice[]>;
  /** GET /api/v1/metal-prices/history */
  metalPriceHistory(metal: MetalType, days?: number): Promise<MetalPrice[]>;
  /** GET /api/v1/exchange-rates/latest */
  latestExchangeRates(): Promise<ExchangeRate[]>;
}
