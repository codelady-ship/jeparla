import type { Role } from "@/lib/auth/session";
import type {
  Category,
  CheckStatus,
  Decimal,
  Fineness,
  IsoDate,
  LocalizedText,
  MetalType,
  Money,
  ProductStatus,
} from "./api";

/** Admin panel data (PLAN 5.8). The backend checks the ADMIN role on every call. */

export type StoreStatus = "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED";

export type AdminStore = {
  id: number;
  slug: string;
  name: string;
  city: string;
  owner: string;
  /** Phone or email of the owner. */
  phone: string;
  submittedAt: IsoDate;
  status: StoreStatus;
  /** Reason of the last reject or block, shown to the seller. */
  note: string | null;
  /** Not reported by the API yet: null. */
  productCount: number | null;
  /** Street address and the map point the seller set (#116); the admin checks one against the other. */
  address?: string;
  geo?: { lat: string; lng: string } | null;
};

export type ModerationItem = {
  id: number;
  slug: string;
  name: LocalizedText;
  imageUrl: string | null;
  store: { id: number; name: string };
  /** The API list carries no variant data yet: null. */
  metal: MetalType | null;
  fineness: string | null;
  priceFrom: Money | null;
  submittedAt: IsoDate;
  status: ProductStatus;
  note: string | null;
};

/** Which badge a check grants: seller identity, store documents, product expertise. */
export type CheckKind = "seller" | "documents" | "expertise";
export type DocumentKind = "TAX_ID" | "TRADE_LICENSE" | "ASSAY_CERTIFICATE" | "LAB_REPORT";

export type VerificationDocument = {
  id: string;
  kind: DocumentKind;
  fileName: string;
  /** Page count is not known for a real upload: null. */
  pages: number | null;
};

/** One request; on the real API every uploaded document is its own request (id = document UUID). */
export type VerificationRequest = {
  id: string;
  store: { id: number; name: string; city: string };
  check: CheckKind;
  /** The product an expertise document is for. */
  product?: { id: number; name: string } | null;
  /** Seller check: who the admin is checking (the API has no separate files for it). */
  owner?: { name: string; contact: string | null; taxId: string | null };
  documents: VerificationDocument[];
  submittedAt: IsoDate;
  status: CheckStatus;
  note: string | null;
};

export type AdminOverview = {
  pendingStores: number;
  productsInReview: number;
  pendingChecks: number;
  stores: number;
  liveProducts: number;
  metalPriceDate: IsoDate;
  openReports: number;
  heldPrices: number;
};

// ---------------------------------------------------------------- catalog settings

export type AdminCategory = Category;

export type AdminFineness = Fineness & { productCount: number };

/** Search treats the two words as the same query, in both directions (PLAN 5.4). */
export type SynonymPair = {
  id: number;
  term: string;
  synonym: string;
};

// ---------------------------------------------------------------- users

export type AdminUser = {
  id: number;
  name: string;
  /** A seller can sign up with a phone only: then email is null. */
  email: string | null;
  phone: string | null;
  role: Role;
  status: UserStatus;
  /** The store a MERCHANT owns, if any. */
  storeName: string | null;
  createdAt: IsoDate;
};

export type UserStatus = "ACTIVE" | "BLOCKED";

// ---------------------------------------------------------------- complaints

export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type ReportReason = "WRONG_PRICE" | "WRONG_INFO" | "FAKE" | "OFFENSIVE" | "OTHER";

/** A buyer's complaint about a product or a whole store. */
export type ProductReport = {
  id: number;
  /** Null for a complaint about the store itself. */
  product: { id: number; slug: string; name: LocalizedText } | null;
  store: { id: number; slug?: string; name: string };
  reason: ReportReason;
  message: string;
  createdAt: IsoDate;
  status: ReportStatus;
  note: string | null;
};

// ---------------------------------------------------------------- audit log

export type AuditTarget =
  "STORE" | "PRODUCT" | "CHECK" | "DOCUMENT" | "USER" | "CATALOG" | "PRICE" | "REPORT";

export type AuditEntry = {
  id: number;
  at: IsoDate;
  actor: string;
  target: AuditTarget;
  targetName: string;
  /** Demo: a key under Admin.auditAction. API: its action code (Admin.auditCode), e.g. STORE_APPROVED. */
  action: AuditAction | string;
  reason: string | null;
};

export type AuditAction =
  | "approve"
  | "reject"
  | "block"
  | "unblock"
  | "return"
  | "deactivate"
  | "verify"
  | "roleChange"
  | "create"
  | "delete"
  | "resolve"
  | "dismiss"
  | "accept"
  | "discard"
  | "override";

// ---------------------------------------------------------------- metal prices

export type QuoteStatus = "HELD" | "APPLIED" | "DISCARDED";

/** A CBAR quote that moved more than the sanity limit and waits for an admin (PLAN 5.10). */
export type HeldQuote = {
  date: IsoDate;
  pricePerOunce: Decimal;
  /** Percent change against the price in use, one decimal. */
  change: Decimal;
  status: QuoteStatus;
};

export type AdminMetalPrice = {
  metal: MetalType;
  date: IsoDate;
  pricePerOunce: Decimal;
  pricePerGram: Decimal;
  previousPerOunce: Decimal;
  /** Percent change against the previous business day, one decimal. */
  change: Decimal;
  /** CBAR, or ADMIN after a manual override. */
  source: "CBAR" | "ADMIN";
  held: HeldQuote | null;
};
