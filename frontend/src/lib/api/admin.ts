import Big from "big.js";
import { gramPrice, percentChange } from "@/lib/pricing";
import type { MetalType, Product, ProductStatus } from "@/types/api";
import type {
  AdminCategory,
  AdminFineness,
  AdminMetalPrice,
  AdminOverview,
  AdminStore,
  AdminUser,
  AuditEntry,
  ModerationItem,
  ProductReport,
  SynonymGroup,
  VerificationRequest,
} from "@/types/admin";
import { USING_MOCK } from "./index";
import {
  CATEGORIES,
  FINENESSES,
  METAL_PRICE_HISTORY,
  PRICE_DATE,
  PRODUCTS,
  STORES,
} from "./mock/fixtures";

/**
 * Admin panel reads (PLAN 5.8): GET /api/v1/admin/{overview,stores,products,verifications,
 * categories,finenesses,synonyms,users,reports,audit,metal-prices}.
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
  categories(): Promise<AdminCategory[]>;
  finenesses(): Promise<AdminFineness[]>;
  synonyms(): Promise<SynonymGroup[]>;
  users(): Promise<AdminUser[]>;
  user(id: number): Promise<AdminUser | null>;
  reports(): Promise<ProductReport[]>;
  report(id: number): Promise<ProductReport | null>;
  audit(): Promise<AuditEntry[]>;
  metalPrices(): Promise<AdminMetalPrice[]>;
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

const ADMIN_FINENESSES: AdminFineness[] = FINENESSES.map((f) => ({
  ...f,
  productCount: PRODUCTS.filter((p) => p.variants.some((v) => v.fineness.id === f.id)).length,
}));

const SYNONYMS: SynonymGroup[] = [
  { id: 1, locale: "az", term: "üzük", synonyms: ["uzuk", "üzüy"] },
  { id: 2, locale: "az", term: "boyunbağı", synonyms: ["boyunbagi", "kulon"] },
  { id: 3, locale: "az", term: "qolbaq", synonyms: ["qolbag", "bilərzik"] },
  { id: 4, locale: "en", term: "necklace", synonyms: ["pendant", "chain"] },
  { id: 5, locale: "en", term: "earrings", synonyms: ["studs", "hoops"] },
  { id: 6, locale: "ru", term: "кольцо", synonyms: ["колечко", "перстень"] },
  { id: 7, locale: "ru", term: "серьги", synonyms: ["сережки"] },
];

const USERS: AdminUser[] = [
  {
    id: 1,
    name: "Jeparla Admin",
    email: "admin@example.com",
    role: "ADMIN",
    storeName: null,
    createdAt: "2026-08-20T09:00:00+04:00",
  },
  ...STORES.map((s, i) => ({
    id: 10 + s.id,
    name: OWNERS[i % OWNERS.length],
    email: `seller${s.id}@example.com`,
    role: "MERCHANT" as const,
    storeName: s.name,
    createdAt: s.createdAt,
  })),
  {
    id: 30,
    name: "Leyla A.",
    email: "leyla@example.com",
    role: "USER",
    storeName: null,
    createdAt: "2026-10-12T14:20:00+04:00",
  },
  {
    id: 31,
    name: "Murad İ.",
    email: "murad@example.com",
    role: "USER",
    storeName: null,
    createdAt: "2026-10-30T19:05:00+04:00",
  },
  {
    id: 32,
    name: "Günel S.",
    email: "gunel@example.com",
    role: "USER",
    storeName: null,
    createdAt: "2026-11-04T08:40:00+04:00",
  },
];

const reported = (i: number) => {
  const p = PRODUCTS[i];
  return {
    product: { id: p.id, slug: p.slug, name: p.name },
    store: { id: p.store.id, name: p.store.name },
  };
};

const REPORTS: ProductReport[] = [
  {
    id: 1,
    ...reported(3),
    reason: "WRONG_PRICE",
    message: "Mağazada qiymət saytdakından 120 manat bahadır.",
    createdAt: "2026-11-07T16:10:00+04:00",
    status: "OPEN",
    note: null,
  },
  {
    id: 2,
    ...reported(11),
    reason: "WRONG_INFO",
    message: "Çəki 3,2 q yazılıb, mağazada 2,8 q dedilər.",
    createdAt: "2026-11-06T11:45:00+04:00",
    status: "OPEN",
    note: null,
  },
  {
    id: 3,
    ...reported(20),
    reason: "FAKE",
    message: "Şəkil başqa saytdan götürülüb.",
    createdAt: "2026-11-05T20:30:00+04:00",
    status: "OPEN",
    note: null,
  },
  {
    id: 4,
    ...reported(7),
    reason: "OTHER",
    message: "WhatsApp nömrəsi cavab vermir.",
    createdAt: "2026-10-29T10:00:00+04:00",
    status: "RESOLVED",
    note: "Mağaza nömrəni yenilədi.",
  },
  {
    id: 5,
    ...reported(15),
    reason: "OFFENSIVE",
    message: "Təsvirdə reklam linki var.",
    createdAt: "2026-10-25T13:15:00+04:00",
    status: "DISMISSED",
    note: "Təsvirdə link tapılmadı, şikayət təsdiqlənmədi.",
  },
];

const AUDIT: AuditEntry[] = [
  {
    id: 12,
    at: "2026-11-07T12:02:00+04:00",
    actor: "admin@example.com",
    target: "PRODUCT",
    targetName: PRODUCTS[2].name.az,
    action: "approve",
    reason: null,
  },
  {
    id: 11,
    at: "2026-11-06T17:40:00+04:00",
    actor: "admin@example.com",
    target: "REPORT",
    targetName: `#4 · ${PRODUCTS[7].store.name}`,
    action: "resolve",
    reason: "Mağaza nömrəni yenilədi.",
  },
  {
    id: 10,
    at: "2026-11-05T09:30:00+04:00",
    actor: "admin@example.com",
    target: "CATALOG",
    targetName: "üzük",
    action: "create",
    reason: null,
  },
  {
    id: 9,
    at: "2026-11-04T10:20:00+04:00",
    actor: "admin@example.com",
    target: "PRICE",
    targetName: "PALLADIUM",
    action: "discard",
    reason: "AMB faylında vergül səhvi, növbəti gün düzəldildi.",
  },
  {
    id: 8,
    at: "2026-11-03T15:00:00+04:00",
    actor: "admin@example.com",
    target: "USER",
    targetName: "seller6@example.com",
    action: "roleChange",
    reason: "Mağaza müraciəti təsdiqləndi, satıcı rolu verildi.",
  },
  {
    id: 7,
    at: "2026-11-02T18:25:00+04:00",
    actor: "admin@example.com",
    target: "CHECK",
    targetName: STORES[0].name,
    action: "verify",
    reason: null,
  },
  {
    id: 6,
    at: "2026-10-28T17:10:00+04:00",
    actor: "admin@example.com",
    target: "STORE",
    targetName: "Test Mağaza",
    action: "reject",
    reason: "VÖEN və ünvan uyğun gəlmir.",
  },
  {
    id: 5,
    at: "2026-10-20T10:30:00+04:00",
    actor: "admin@example.com",
    target: "STORE",
    targetName: "Almaz Ev",
    action: "block",
    reason: "Əyar möhürü olmayan məhsullar təkrar yerləşdirilib.",
  },
];

const METALS: MetalType[] = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"];

/**
 * Latest and previous business day per metal. Palladium has a next-day quote
 * held by the sanity check (more than 10% up), so the panel always shows one.
 */
const METAL_PRICES: AdminMetalPrice[] = METALS.map((metal) => {
  const rows = METAL_PRICE_HISTORY.filter((p) => p.metal === metal);
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const heldOunce =
    metal === "PALLADIUM"
      ? new Big(last.pricePerOunce).times("1.124").round(2, Big.roundHalfUp).toFixed(2)
      : null;
  return {
    metal,
    date: last.date,
    pricePerOunce: last.pricePerOunce,
    pricePerGram: gramPrice(last.pricePerOunce),
    previousPerOunce: prev.pricePerOunce,
    change: percentChange(prev.pricePerOunce, last.pricePerOunce),
    source: "CBAR" as const,
    held: heldOunce
      ? {
          date: "2026-11-04",
          pricePerOunce: heldOunce,
          change: percentChange(last.pricePerOunce, heldOunce),
          status: "HELD" as const,
        }
      : null,
  };
});

const mockAdminApi: AdminApi = {
  async overview() {
    return {
      pendingStores: APPLICATIONS.filter((s) => s.status === "PENDING").length,
      productsInReview: MODERATION.filter((p) => p.status === "IN_REVIEW").length,
      pendingChecks: VERIFICATIONS.filter((v) => v.status === "PENDING").length,
      stores: APPLICATIONS.filter((s) => s.status === "APPROVED").length,
      liveProducts: MODERATION.filter((p) => p.status === "APPROVED").length,
      metalPriceDate: PRICE_DATE,
      openReports: REPORTS.filter((r) => r.status === "OPEN").length,
      heldPrices: METAL_PRICES.filter((m) => m.held?.status === "HELD").length,
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
  async categories() {
    return CATEGORIES;
  },
  async finenesses() {
    return ADMIN_FINENESSES;
  },
  async synonyms() {
    return SYNONYMS;
  },
  async users() {
    return USERS;
  },
  async user(id) {
    return USERS.find((u) => u.id === id) ?? null;
  },
  async reports() {
    return REPORTS;
  },
  async report(id) {
    return REPORTS.find((r) => r.id === id) ?? null;
  },
  async audit() {
    return AUDIT;
  },
  async metalPrices() {
    return METAL_PRICES;
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
    categories: fail,
    finenesses: fail,
    synonyms: fail,
    users: fail,
    user: fail,
    reports: fail,
    report: fail,
    audit: fail,
    metalPrices: fail,
  };
}

export const adminApi: AdminApi = USING_MOCK ? mockAdminApi : httpAdminApi();
