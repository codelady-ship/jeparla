import { userFetch } from "@/lib/auth/backend";
import type { CheckStatus, ProductStatus } from "@/types/api";
import type {
  AdminMetalPrice,
  AdminStore,
  AuditEntry,
  AuditTarget,
  CheckKind,
  DocumentKind,
  ModerationItem,
  StoreStatus,
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
  ownerName: string;
  ownerContact: string | null;
  createdAt: string;
};

type BackendProduct = {
  id: number;
  slug: string;
  name: string;
  storeId: number;
  storeName: string;
  status: ProductStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
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
  productCount: null,
});

export const toModerationItem = (p: BackendProduct): ModerationItem => ({
  id: p.id,
  slug: p.slug,
  // The admin list carries the Azerbaijani name only.
  name: { az: p.name, en: p.name, ru: p.name },
  imageUrl: null,
  store: { id: p.storeId, name: p.storeName },
  metal: null,
  fineness: null,
  priceFrom: null,
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

export const toAuditEntry = (a: BackendAudit): AuditEntry => ({
  id: a.id,
  at: a.createdAt,
  actor: a.actorLabel,
  target: a.targetType,
  targetName: a.targetName ?? a.targetId ?? "",
  action: a.action,
  reason: a.reason,
});

/**
 * The admin panel on the real API, read as the signed-in admin (the backend checks the
 * ADMIN role on every call). Categories, synonyms, users and complaints have no admin API
 * yet: their pages say so instead of reading here, so these answer empty.
 */
export const httpAdminApi: AdminApi = {
  async overview() {
    const [pendingStores, productsInReview, pendingChecks, stores, liveProducts, prices] =
      await Promise.all([
        total("/admin/stores", "PENDING"),
        total("/admin/products", "IN_REVIEW"),
        total("/admin/documents", "PENDING"),
        total("/admin/stores", "APPROVED"),
        total("/admin/products", "APPROVED"),
        userFetch<AdminMetalPrice[]>("/admin/metal-prices"),
      ]);
    return {
      pendingStores,
      productsInReview,
      pendingChecks,
      stores,
      liveProducts,
      metalPriceDate: prices[0]?.date ?? "",
      openReports: null,
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
    // The queue first, then what is live, so a long catalog does not push the queue out.
    const [review, rest] = await Promise.all([
      list<BackendProduct>("/admin/products", { status: "IN_REVIEW" }),
      list<BackendProduct>("/admin/products"),
    ]);
    const seen = new Set(review.content.map((p) => p.id));
    return [...review.content, ...rest.content.filter((p) => !seen.has(p.id))].map(
      toModerationItem,
    );
  },
  async product(id) {
    return (await this.products()).find((p) => p.id === id) ?? null;
  },
  async verifications() {
    const [pending, rest] = await Promise.all([
      list<BackendDocument>("/admin/documents", { status: "PENDING" }),
      list<BackendDocument>("/admin/documents"),
    ]);
    const seen = new Set(pending.content.map((d) => d.id));
    return [...pending.content, ...rest.content.filter((d) => !seen.has(d.id))].map(toVerification);
  },
  async verification(id) {
    const d = await orNull(userFetch<BackendDocument>(`/admin/documents/${id}`));
    return d && toVerification(d);
  },
  categories: async () => [],
  finenesses: async () => [],
  synonyms: async () => [],
  users: async () => [],
  user: async () => null,
  reports: async () => [],
  report: async () => null,
  async audit() {
    return (await list<BackendAudit>("/admin/audit")).content.map(toAuditEntry);
  },
  metalPrices: () => userFetch<AdminMetalPrice[]>("/admin/metal-prices"),
};
