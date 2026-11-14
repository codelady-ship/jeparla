import { userFetch } from "@/lib/auth/backend";
import type { IsoDate, Page } from "@/types/api";
import { USING_MOCK } from "./mode";

/**
 * Signed-in reads of the cabinet that exist only with the backend: notifications (#138)
 * and the seller's verification documents (#40). With the sample data they are empty; the
 * pages say that the section needs the real server instead of showing invented items.
 */

export type Notification = {
  id: number;
  kind: string;
  language: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: IsoDate;
  readAt: IsoDate | null;
};

export type DocumentKind = "TAX_ID" | "TRADE_LICENSE" | "ASSAY_CERTIFICATE" | "LAB_REPORT";
export type DocumentStatus = "PENDING" | "VERIFIED" | "REJECTED" | "CHANGES_REQUESTED";
export type RejectReason =
  "UNREADABLE" | "EXPIRED" | "MISMATCH" | "WRONG_TYPE" | "HALLMARK_MISSING" | "AUTHENTICITY";

export type MerchantDocument = {
  id: string;
  checkKind: "SELLER" | "DOCUMENTS" | "EXPERTISE";
  kind: DocumentKind;
  productId: number | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus;
  rejectReason: RejectReason | null;
  reviewNote: string | null;
  createdAt: IsoDate;
  reviewedAt: IsoDate | null;
};

export type Declaration = { version: string; language: string; text: string; draft: boolean };

const EMPTY_PAGE: Page<Notification> = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

export const notifications = (page = 0): Promise<Page<Notification>> =>
  USING_MOCK
    ? Promise.resolve(EMPTY_PAGE)
    : userFetch(`/notifications`, { query: { page, size: 20 } });

export const unreadCount = async (): Promise<number> =>
  USING_MOCK ? 0 : (await userFetch<{ unread: number }>("/notifications/unread-count")).unread;

export const merchantDocuments = (): Promise<MerchantDocument[]> =>
  USING_MOCK ? Promise.resolve([]) : userFetch("/merchant/documents");

export const declaration = (locale: string): Promise<Declaration | null> =>
  USING_MOCK ? Promise.resolve(null) : userFetch("/merchant/documents/declaration", { locale });
