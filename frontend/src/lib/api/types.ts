import type {
  Category,
  CompareItem,
  Fineness,
  MetalPrice,
  MetalType,
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
  /** GET /api/v1/finenesses */
  listFinenesses(): Promise<Fineness[]>;
  /** GET /api/v1/stores */
  listStores(params?: { q?: string; city?: string }): Promise<StoreSummary[]>;
  /** GET /api/v1/stores/{slug} */
  getStore(slug: string): Promise<Store | null>;
  /** GET /api/v1/stores/{slug}/products */
  listStoreProducts(slug: string, filters?: ProductFilters): Promise<Page<ProductSummary>>;
  /** GET /api/v1/search */
  search(q: string, type?: SearchType, page?: number): Promise<SearchResult>;
  /** GET /api/v1/search/suggest */
  suggest(q: string): Promise<Suggestions>;
  /** GET /api/v1/metal-prices/latest */
  latestMetalPrices(): Promise<MetalPrice[]>;
  /** GET /api/v1/metal-prices/history */
  metalPriceHistory(metal: MetalType, days?: number): Promise<MetalPrice[]>;
}
