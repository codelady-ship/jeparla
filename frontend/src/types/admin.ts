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
  phone: string;
  submittedAt: IsoDate;
  status: StoreStatus;
  /** Reason of the last reject or block, shown to the seller. */
  note: string | null;
  productCount: number;
};

export type ModerationItem = {
  id: number;
  slug: string;
  name: LocalizedText;
  imageUrl: string | null;
  store: { id: number; name: string };
  metal: MetalType;
  fineness: string;
  priceFrom: Money;
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
  pages: number;
};

export type VerificationRequest = {
  id: number;
  store: { id: number; name: string; city: string };
  check: CheckKind;
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

export type SynonymLocale = "az" | "en" | "ru";

/** Search treats every word of a group as the same query (PLAN 5.4). */
export type SynonymGroup = {
  id: number;
  locale: SynonymLocale;
  term: string;
  synonyms: string[];
};

// ---------------------------------------------------------------- users

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** The store a MERCHANT owns, if any. */
  storeName: string | null;
  createdAt: IsoDate;
};

// ---------------------------------------------------------------- complaints

export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type ReportReason = "WRONG_PRICE" | "WRONG_INFO" | "FAKE" | "OFFENSIVE" | "OTHER";

/** A buyer's complaint about a product (POST /api/v1/products/{id}/reports). */
export type ProductReport = {
  id: number;
  product: { id: number; slug: string; name: LocalizedText };
  store: { id: number; name: string };
  reason: ReportReason;
  message: string;
  createdAt: IsoDate;
  status: ReportStatus;
  note: string | null;
};

// ---------------------------------------------------------------- audit log

export type AuditTarget = "STORE" | "PRODUCT" | "CHECK" | "USER" | "CATALOG" | "PRICE" | "REPORT";

export type AuditEntry = {
  id: number;
  at: IsoDate;
  actor: string;
  target: AuditTarget;
  targetName: string;
  /** Message key under Admin.auditAction. */
  action: AuditAction;
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
