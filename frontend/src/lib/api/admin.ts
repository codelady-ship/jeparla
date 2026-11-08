import type { Product, ProductStatus } from "@/types/api";
import type { AdminOverview, AdminStore, ModerationItem, VerificationRequest } from "@/types/admin";
import { USING_MOCK } from "./index";
import { PRICE_DATE, PRODUCTS, STORES } from "./mock/fixtures";

/**
 * Admin panel reads (PLAN 5.8): GET /api/v1/admin/{overview,stores,products,verifications}.
 * Only ADMIN tokens are accepted by the backend; the panel never decides access itself.
 */
export interface AdminApi {
  overview(): Promise<AdminOverview>;
  stores(): Promise<AdminStore[]>;
  store(id: number): Promise<AdminStore | null>;
  products(): Promise<ModerationItem[]>;
  product(id: number): Promise<ModerationItem | null>;
  verifications(): Promise<VerificationRequest[]>;
  verification(id: number): Promise<VerificationRequest | null>;
}

// ------------------------------------------------------------------ demo data
// Invented names and numbers, like the rest of the mock (labelled demo in the UI).

const OWNERS = ["Aynur M.", "Rauf H.", "Səbinə Q.", "Elvin T.", "Nigar Ə.", "Kamran S."];

const APPLICATIONS: AdminStore[] = [
  ...STORES.map((s, i) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    city: s.city,
    owner: OWNERS[i % OWNERS.length],
    phone: s.phone,
    submittedAt: s.createdAt,
    // Stores in the catalog are live; their own badges are checked under verification.
    status: "APPROVED" as const,
    note: null,
    productCount: PRODUCTS.filter((p) => p.store.id === s.id).length,
  })),
  {
    id: 7,
    slug: "gunes-zerger",
    name: "Günəş Zərgər",
    city: "Şəki",
    owner: "Fidan R.",
    phone: "+994500000007",
    submittedAt: "2026-11-06T12:30:00+04:00",
    status: "PENDING",
    note: null,
    productCount: 0,
  },
  {
    id: 10,
    slug: "mirvari-ev",
    name: "Mirvari Ev",
    city: "Quba",
    owner: "Lalə K.",
    phone: "+994500000010",
    submittedAt: "2026-11-07T18:10:00+04:00",
    status: "PENDING",
    note: null,
    productCount: 0,
  },
  {
    id: 8,
    slug: "almaz-ev",
    name: "Almaz Ev",
    city: "Bakı",
    owner: "Tural N.",
    phone: "+994500000008",
    submittedAt: "2026-10-20T10:00:00+04:00",
    status: "BLOCKED",
    note: "Əyar möhürü olmayan məhsullar təkrar yerləşdirilib.",
    productCount: 0,
  },
  {
    id: 9,
    slug: "test-magaza",
    name: "Test Mağaza",
    city: "Bakı",
    owner: "Orxan B.",
    phone: "+994500000009",
    submittedAt: "2026-10-28T16:45:00+04:00",
    status: "REJECTED",
    note: "VÖEN və ünvan uyğun gəlmir.",
    productCount: 0,
  },
];

/** Every 9th catalog product is shown as freshly submitted, so the queue is never empty. */
const IN_REVIEW = new Set(PRODUCTS.filter((_, i) => i % 9 === 4).map((p) => p.id));

function moderationItem(p: Product): ModerationItem {
  const status: ProductStatus = IN_REVIEW.has(p.id) ? "IN_REVIEW" : p.status;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    imageUrl: p.images[0]?.url ?? null,
    store: { id: p.store.id, name: p.store.name },
    metal: p.metal,
    fineness: p.variants[0]?.fineness.label ?? "",
    priceFrom: p.priceFrom,
    submittedAt: p.publishedAt,
    status,
    note: null,
  };
}

const MODERATION: ModerationItem[] = PRODUCTS.map(moderationItem).sort(
  (a, b) =>
    Number(b.status === "IN_REVIEW") - Number(a.status === "IN_REVIEW") ||
    b.submittedAt.localeCompare(a.submittedAt),
);

const at = (id: number) => STORES.find((s) => s.id === id)!;
const ref = (id: number) => ({ id, name: at(id).name, city: at(id).city });

const VERIFICATIONS: VerificationRequest[] = [
  {
    id: 1,
    store: ref(6),
    check: "seller",
    documents: [
      { id: "d1", kind: "TAX_ID", fileName: "voen.pdf", pages: 1 },
      { id: "d2", kind: "TRADE_LICENSE", fileName: "lisenziya.pdf", pages: 2 },
    ],
    submittedAt: "2026-11-07T11:20:00+04:00",
    status: "PENDING",
    note: null,
  },
  {
    id: 2,
    store: ref(3),
    check: "documents",
    documents: [
      { id: "d3", kind: "ASSAY_CERTIFICATE", fileName: "eyar-sertifikati.jpg", pages: 1 },
    ],
    submittedAt: "2026-11-05T09:05:00+04:00",
    status: "PENDING",
    note: null,
  },
  {
    id: 3,
    store: ref(5),
    check: "expertise",
    documents: [
      { id: "d4", kind: "LAB_REPORT", fileName: "gia-hesabat.pdf", pages: 3 },
      { id: "d5", kind: "ASSAY_CERTIFICATE", fileName: "eyar.pdf", pages: 1 },
    ],
    submittedAt: "2026-11-02T15:40:00+04:00",
    status: "PENDING",
    note: null,
  },
  {
    id: 4,
    store: ref(1),
    check: "documents",
    documents: [{ id: "d6", kind: "TRADE_LICENSE", fileName: "lisenziya.pdf", pages: 2 }],
    submittedAt: "2026-09-02T10:00:00+04:00",
    status: "VERIFIED",
    note: null,
  },
];

const mockAdminApi: AdminApi = {
  async overview() {
    return {
      pendingStores: APPLICATIONS.filter((s) => s.status === "PENDING").length,
      productsInReview: MODERATION.filter((p) => p.status === "IN_REVIEW").length,
      pendingChecks: VERIFICATIONS.filter((v) => v.status === "PENDING").length,
      stores: APPLICATIONS.filter((s) => s.status === "APPROVED").length,
      liveProducts: MODERATION.filter((p) => p.status === "APPROVED").length,
      metalPriceDate: PRICE_DATE,
    };
  },
  async stores() {
    return APPLICATIONS;
  },
  async store(id) {
    return APPLICATIONS.find((s) => s.id === id) ?? null;
  },
  async products() {
    return MODERATION;
  },
  async product(id) {
    return MODERATION.find((p) => p.id === id) ?? null;
  },
  async verifications() {
    return VERIFICATIONS;
  },
  async verification(id) {
    return VERIFICATIONS.find((v) => v.id === id) ?? null;
  },
};

function httpAdminApi(): AdminApi {
  // Connected with the backend auth (Day 6, issue #40); until then the panel runs on the mock.
  const fail = () => Promise.reject(new Error("Admin API is not connected yet"));
  return {
    overview: fail,
    stores: fail,
    store: fail,
    products: fail,
    product: fail,
    verifications: fail,
    verification: fail,
  };
}

export const adminApi: AdminApi = USING_MOCK ? mockAdminApi : httpAdminApi();
