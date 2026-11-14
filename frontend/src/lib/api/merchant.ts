import type { Session } from "@/lib/auth/session";
import type { Product, ProductStatus } from "@/types/api";
import type {
  MerchantDashboard,
  MerchantProduct,
  MerchantProductRow,
  MerchantStore,
  ProductInput,
} from "@/types/merchant";
import { userFetch } from "@/lib/auth/backend";
import { EMPTY_PRICING } from "@/lib/merchant/draft";
import { toMerchantProduct, type BackendProduct } from "@/lib/merchant/backend";
import { ApiError } from "./http";
import { api as publicApi, USING_MOCK } from "./index";
import { CATEGORIES, PRODUCTS, STORES } from "./mock/fixtures";

/**
 * Merchant cabinet reads (PLAN 5.5): GET /api/v1/merchant/{store,dashboard,products}.
 * The backend finds the store from the JWT and checks ownership on every call; the
 * session argument only picks the demo store while the mock is in use.
 */
export interface MerchantApi {
  store(): Promise<MerchantStore>;
  dashboard(): Promise<MerchantDashboard>;
  products(): Promise<MerchantProductRow[]>;
  product(id: number): Promise<MerchantProduct | null>;
}

const STATUSES: ProductStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED", "RETURNED", "INACTIVE"];

/**
 * Demo sellers: merchant@... owns the approved demo store with its products;
 * merchant+new@... and accounts made in the /sell wizard (phone as id) own a new
 * store that still waits for checks and has no products.
 */
export function isNewDemoSeller(session: Session): boolean {
  const local = session.email.split("@")[0]?.toLowerCase() ?? "";
  return local.startsWith("merchant+") || session.email.startsWith("+");
}

const DEMO_STORE = STORES[0];

/** Private demo products next to the public ones, so every status is visible. */
const EXTRA: { from: number; id: number; status: ProductStatus; note: string | null }[] = [
  { from: 0, id: 9001, status: "DRAFT", note: null },
  { from: 1, id: 9002, status: "IN_REVIEW", note: null },
  {
    from: 2,
    id: 9003,
    status: "RETURNED",
    note: "Əyar möhürünün aydın şəkli lazımdır. / A clear photo of the hallmark is needed.",
  },
  { from: 3, id: 9004, status: "INACTIVE", note: null },
];

function demoProducts(): { product: Product; status: ProductStatus; note: string | null }[] {
  const own = PRODUCTS.filter((p) => p.store.id === DEMO_STORE.id);
  return [
    ...EXTRA.map((e) => ({
      product: { ...own[e.from], id: e.id, slug: `${own[e.from].slug}-${e.id}` },
      status: e.status,
      note: e.note,
    })),
    ...own.map((p) => ({ product: p, status: p.status, note: null })),
  ];
}

/** Deterministic demo statistics (labelled "demo data" in the UI). */
const viewsOf = (id: number) => 20 + ((id * 137) % 400);

function toRow({ product: p, status, note }: ReturnType<typeof demoProducts>[number]) {
  const row: MerchantProductRow = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    imageUrl: p.images[0]?.url ?? null,
    categoryId: p.categoryId,
    status,
    priceFrom: p.priceFrom.amount,
    variantCount: p.variants.length,
    views: status === "APPROVED" || status === "INACTIVE" ? viewsOf(p.id) : 0,
    updatedAt: p.publishedAt,
    reviewNote: note,
  };
  return row;
}

export function toInput(p: Product): ProductInput {
  return {
    images: p.images.map((img, i) => ({ id: `img${i}`, url: img.url, name: img.url })),
    name: p.name.az,
    category: CATEGORIES.find((c) => c.id === p.categoryId)?.slug ?? "",
    description: p.description.az,
    metal: p.metal,
    fineness: String(p.variants[0]?.fineness.id ?? ""),
    pricingMode: p.variants[0]?.pricingMode ?? "FIXED",
    pricing: (() => {
      const r = p.variants.find((v) => v.pricing)?.pricing;
      return r
        ? {
            laborPerGram: r.laborPerGram,
            laborFixed: r.laborFixed,
            stonePrice: r.stonePrice,
            markupPercent: r.markupPercent,
            minPrice: r.minPrice ?? "",
            maxPrice: r.maxPrice ?? "",
          }
        : { ...EMPTY_PRICING };
    })(),
    variants: p.variants.map((v) => ({
      key: `v${v.id}`,
      size: v.size ?? "",
      weightGrams: v.weightGrams,
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
    docs: [],
  };
}

function mockMerchantApi(session: Session): MerchantApi {
  const fresh = isNewDemoSeller(session);
  const items = fresh ? [] : demoProducts();
  return {
    async store() {
      if (fresh)
        return {
          id: 100,
          slug: "yeni-magaza",
          name: session.name,
          city: "",
          address: "",
          whatsapp: session.email.startsWith("+") ? session.email : "",
          social: "",
          description: "",
          openingHours: "",
          sellerStatus: "PENDING",
        };
      return {
        id: DEMO_STORE.id,
        slug: DEMO_STORE.slug,
        name: DEMO_STORE.name,
        city: DEMO_STORE.city,
        address: DEMO_STORE.address,
        whatsapp: DEMO_STORE.whatsapp,
        social: "@ayzer.demo",
        description: DEMO_STORE.description.az,
        openingHours: "Mo-Fr 10:00-19:00; Sa 11:00-17:00",
        sellerStatus: DEMO_STORE.verification.seller,
      };
    },
    async dashboard() {
      const rows = items.map(toRow);
      const counts = Object.fromEntries(
        STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]),
      ) as MerchantDashboard["counts"];
      const views = rows.reduce((sum, r) => sum + (r.views ?? 0), 0);
      return { views, whatsappClicks: Math.round(views * 0.06), counts };
    },
    async products() {
      return items.map(toRow);
    },
    async product(id) {
      const hit = items.find((i) => i.product.id === id);
      return hit ? { id, status: hit.status, input: toInput(hit.product) } : null;
    },
  };
}

/**
 * The backend finds the store from the access token; the proxy refreshed the token before
 * this render (server components never rotate it themselves).
 */
function httpMerchantApi(): MerchantApi {
  return {
    store: () => userFetch<MerchantStore>("/merchant/store"),
    dashboard: () => userFetch<MerchantDashboard>("/merchant/dashboard"),
    products: () => userFetch<MerchantProductRow[]>("/merchant/products"),
    async product(id) {
      try {
        const [p, categories] = await Promise.all([
          userFetch<BackendProduct>(`/merchant/products/${id}`),
          publicApi.listCategories(),
        ]);
        return toMerchantProduct(p, categories);
      } catch (e) {
        // Someone else's product is 403, a deleted one 404: both are "not found" here.
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
        throw e;
      }
    },
  };
}

export function merchantApi(session: Session): MerchantApi {
  return USING_MOCK ? mockMerchantApi(session) : httpMerchantApi();
}
