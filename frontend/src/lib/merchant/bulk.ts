import type { Decimal } from "@/types/api";

/**
 * Bulk product entry in the seller cabinet (#109 CSV import, #129 drafts from photos and
 * catalog PDFs). Types follow backend `DraftDtos` and `ImportResultDto`.
 */

export type DraftSource = "PHOTO" | "CAMERA" | "PDF";

/** A product draft: one private photo and, for a PDF page with one photo, suggestions. */
export type MerchantDraft = {
  id: number;
  source: DraftSource;
  /** Private link, valid for about 15 minutes. */
  imageUrl: string;
  imageUrlExpiresAt: string;
  width: number;
  height: number;
  pdfPage: number | null;
  suggestedName: string | null;
  suggestedPrice: Decimal | null;
  suggestedWeight: Decimal | null;
  /** Cleaned text of a PDF page with one photo; absent from older backends. */
  pageText?: string | null;
  createdAt: string;
};

export type PdfImportResult = { drafts: MerchantDraft[]; limited: boolean };

export type ImportRowError = { line: number; column: string | null; code: string; message: string };

export type ImportResult = {
  rows: number;
  created: { line: number; productId: number; created: boolean }[];
  errors: ImportRowError[];
};

export type BulkStatusResult = {
  id: number;
  ok: boolean;
  status: string | null;
  code: string | null;
  message: string | null;
};

/** Presigned PUT the browser uploads one photo or PDF with. */
export type DraftUpload = {
  key: string;
  url: string;
  method: string;
  headers: Record<string, string>;
};

/** Limits the backend applies; checked in the browser first for a quick answer. */
export const DRAFT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DRAFT_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const DRAFT_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const IMPORT_MAX_BYTES = 1024 * 1024;
/** Media type of an Excel .xlsx workbook (#109). */
export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
