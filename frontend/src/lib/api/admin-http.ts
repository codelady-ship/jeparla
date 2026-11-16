import { userFetch } from "@/lib/auth/backend";
import type { Role } from "@/lib/auth/session";
import type { CheckStatus, LocalizedText, MetalType, Money, ProductStatus } from "@/types/api";
import type {
  AdminCategory,
  AdminFineness,
  AdminMetalPrice,
  AdminStore,
  AdminUser,
  AuditEntry,
  AuditTarget,
  CheckKind,
  DocumentKind,
  ModerationItem,
  ProductReport,
  ReportReason,
  ReportStatus,
  StoreStatus,
  SynonymPair,
  UserStatus,
  VerificationRequest,
} from "@/types/admin";
import type { AdminApi } from "./admin";
import { ApiError, isNotFound } from "./http";

/** Shapes of /api/v1/admin/* (backend az.jeparla.admin.dto, verification.dto). */

type Page<T> = { content: T[]; totalElements: number };

type BackendStore = {
  id: number;
  slug: string;
  name: string;
  city: string;
  status: StoreStatus;
  statusNote: string | null;
  sellerStatus: CheckStatus;
  taxId: string | null;
  ownerName: string;
  ownerContact: string | null;
  createdAt: string;
  productCount: number;
  address?: string;
  geo?: { lat: string; lng: string } | null;
};

type BackendProduct = {
  id: number;
  slug: string;
  name: string;
  names: LocalizedText | null;
  storeId: number;
  storeName: string;
  status: ProductStatus;
  metal: MetalType | null;
  reviewNote: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  priceFrom: Money | null;
  finenessLabel: string | null;
  imageUrl: string | null;
};

export type DocumentStatus = "PENDING" | "VERIFIED" | "REJECTED" | "CHANGES_REQUESTED";

type BackendDocument = {
  id: string;
  storeId: number;
  storeName: string;
  productId: number | null;
  productName: string | null;
  checkKind: "DOCUMENTS" | "EXPERTISE";
  kind: DocumentKind;
  fileName: string;
  status: DocumentStatus;
  rejectReason: string | null;
  reviewNote: string | null;
  createdAt: string;
};

type BackendAudit = {
  id: number;
  actorLabel: string;
  action: string;
  targetType: AuditTarget;
  targetName: string | null;
  targetId: string | null;
  reason: string | null;
  createdAt: string;
};

type BackendUser = {
  id: number;
  displayName: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
  status: UserStatus;
  storeName: string | null;
  createdAt: string;
};

type BackendReport = {
  id: number;
  product: { id: number; slug: string; name: LocalizedText } | null;
  store: { id: number; slug: string; name: string };
  reason: ReportReason;
  message: string;
  status: ReportStatus;
  note: string | null;
  createdAt: string;
};

/** The admin panel reads up to this many rows per list; filters run in the browser. */
const LIST_SIZE = 100;

const list = <T>(path: string, query: Record<string, string | number | undefined> = {}) =>
  userFetch<Page<T>>(path, { query: { size: LIST_SIZE, ...query } });

const total = async (path: string, status: string) =>
  (await userFetch<Page<unknown>>(path, { query: { status, size: 1 } })).totalElements;

const orNull = async <T>(read: Promise<T>): Promise<T | null> => {
  try {
    return await read;
  } catch (e) {
    if (isNotFound(e) || (e instanceof ApiError && e.status === 403)) return null;
    throw e;
  }
};

/** The queue first, then the rest, without duplicates, so a long list never hides the queue. */
async function queueFirst<T extends { id: number | string }>(
  path: string,
  status: string,
): Promise<T[]> {
  const [queue, rest] = await Promise.all([list<T>(path, { status }), list<T>(path)]);
  const seen = new Set(queue.content.map((r) => r.id));
  return [...queue.content, ...rest.content.filter((r) => !seen.has(r.id))];
}

export const toAdminStore = (s: BackendStore): AdminStore => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  city: s.city,
  owner: s.ownerName,
  phone: s.ownerContact ?? "",
  submittedAt: s.createdAt,
  status: s.status,
  note: s.statusNote,
  productCount: s.productCount ?? null,
  address: s.address,
  geo: s.geo ?? null,
});

export const toModerationItem = (p: BackendProduct): ModerationItem => ({
  id: p.id,
  slug: p.slug,
  name: p.names ?? { az: p.name, en: p.name, ru: p.name },
  imageUrl: p.imageUrl ?? null,
  store: { id: p.storeId, name: p.storeName },
  metal: p.metal ?? null,
  fineness: p.finenessLabel ?? null,
  priceFrom: p.priceFrom ?? null,
  submittedAt: p.submittedAt ?? p.publishedAt ?? "",
  status: p.status,
  note: p.reviewNote,
});

/** A returned document is shown as returned; the seller uploads a new one. */
export const CHECK_OF: Record<DocumentStatus, CheckStatus> = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "REJECTED",
};

const KIND_OF: Record<BackendDocument["checkKind"], CheckKind> = {
  DOCUMENTS: "documents",
  EXPERTISE: "expertise",
};

export const toVerification = (d: BackendDocument): VerificationRequest => ({
  id: d.id,
  store: { id: d.storeId, name: d.storeName, city: "" },
  check: KIND_OF[d.checkKind],
  product: d.productId ? { id: d.productId, name: d.productName ?? "" } : null,
  documents: [{ id: d.id, kind: d.kind, fileName: d.fileName, pages: null }],
  submittedAt: d.createdAt,
  status: CHECK_OF[d.status],
  note: d.reviewNote,
});

/** Seller-check requests are stores; their id is "s" + store id, documents are separate rows. */
export const SELLER_CHECK_PREFIX = "s";

export const toSellerCheck = (s: BackendStore): VerificationRequest => ({
  id: `${SELLER_CHECK_PREFIX}${s.id}`,
  store: { id: s.id, name: s.name, city: s.city },
  check: "seller",
  owner: { name: s.ownerName, contact: s.ownerContact, taxId: s.taxId },
  documents: [],
  submittedAt: s.createdAt,
  status: s.sellerStatus,
  note: null,
});

export const toAuditEntry = (a: BackendAudit): AuditEntry => ({
  id: a.id,
  at: a.createdAt,
  actor: a.actorLabel,
  target: a.targetType,
  targetName: a.targetName ?? a.targetId ?? "",
  action: a.action,
  reason: a.reason,
});

/** The API sorts the roles by name, so an admin is ADMIN first, a seller MERCHANT. */
export const toAdminUser = (u: BackendUser): AdminUser => ({
  id: u.id,
  name: u.displayName,
  email: u.email,
  phone: u.phone,
  role: u.roles[0] ?? "USER",
  status: u.status,
  storeName: u.storeName,
  createdAt: u.createdAt,
});

export const toReport = (r: BackendReport): ProductReport => ({
  id: r.id,
  product: r.product,
  store: r.store,
  reason: r.reason,
  message: r.message,
  createdAt: r.createdAt,
  status: r.status,
  note: r.note,
});

/** The admin panel on the real API, read as the signed-in admin (the backend checks the role). */
export const httpAdminApi: AdminApi = {
  async overview() {
    const [
      pendingStores,
      productsInReview,
      pendingDocuments,
      pendingSellers,
      stores,
      liveProducts,
      openReports,
      prices,
    ] = await Promise.all([
      total("/admin/stores", "PENDING"),
      total("/admin/products", "IN_REVIEW"),
      total("/admin/documents", "PENDING"),
      userFetch<Page<unknown>>("/admin/stores", {
        query: { sellerStatus: "PENDING", size: 1 },
      }).then((p) => p.totalElements),
      total("/admin/stores", "APPROVED"),
      total("/admin/products", "APPROVED"),
      total("/admin/reports", "OPEN"),
      userFetch<AdminMetalPrice[]>("/admin/metal-prices"),
    ]);
    return {
      pendingStores,
      productsInReview,
      pendingChecks: pendingDocuments + pendingSellers,
      stores,
      liveProducts,
      metalPriceDate: prices[0]?.date ?? "",
      openReports,
      heldPrices: prices.filter((p) => p.held?.status === "HELD").length,
    };
  },
  async stores() {
    return (await list<BackendStore>("/admin/stores")).content.map(toAdminStore);
  },
  async store(id) {
    const s = await orNull(userFetch<BackendStore>(`/admin/stores/${id}`));
    return s && toAdminStore(s);
  },
  async products() {
    return (await queueFirst<BackendProduct>("/admin/products", "IN_REVIEW")).map(toModerationItem);
  },
  async product(id) {
    return (await this.products()).find((p) => p.id === id) ?? null;
  },
  async verifications() {
    const [sellers, documents] = await Promise.all([
      list<BackendStore>("/admin/stores", { sellerStatus: "PENDING" }),
      queueFirst<BackendDocument>("/admin/documents", "PENDING"),
    ]);
    return [...sellers.content.map(toSellerCheck), ...documents.map(toVerification)];
  },
  async verification(id) {
    if (id.startsWith(SELLER_CHECK_PREFIX)) {
      const s = await orNull(userFetch<BackendStore>(`/admin/stores/${id.slice(1)}`));
      return s && toSellerCheck(s);
    }
    const d = await orNull(userFetch<BackendDocument>(`/admin/documents/${id}`));
    return d && toVerification(d);
  },
  async categories() {
    return userFetch<AdminCategory[]>("/admin/categories");
  },
  async finenesses() {
    return userFetch<AdminFineness[]>("/admin/finenesses");
  },
  async synonyms() {
    return (await list<SynonymPair>("/admin/synonyms")).content;
  },
  async users() {
    return (await list<BackendUser>("/admin/users")).content.map(toAdminUser);
  },
  async user(id) {
    const u = await orNull(userFetch<BackendUser>(`/admin/users/${id}`));
    return u && toAdminUser(u);
  },
  async reports() {
    return (await queueFirst<BackendReport>("/admin/reports", "OPEN")).map(toReport);
  },
  async report(id) {
    const r = await orNull(userFetch<BackendReport>(`/admin/reports/${id}`));
    return r && toReport(r);
  },
  async audit() {
    return (await list<BackendAudit>("/admin/audit")).content.map(toAuditEntry);
  },
  metalPrices: () => userFetch<AdminMetalPrice[]>("/admin/metal-prices"),
};
