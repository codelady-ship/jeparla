import type { CheckStatus, IsoDate, LocalizedText, MetalType, Money, ProductStatus } from "./api";

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
};
