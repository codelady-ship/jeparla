import { z } from "zod";
import type { MetalType, ProductStatus } from "@/types/api";
import type { EvidenceKind, MaterialKind } from "@/types/merchant";

/**
 * Hallmark and label photo check (#106). An admin compares the photo with the product data
 * (metal, fineness, weight on the label) and marks it VERIFIED or REJECTED with a reason.
 * Types follow backend `AdminEvidencePhotoDto`. Shared by the page, the list and the route.
 */

export const EVIDENCE_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export type AdminEvidencePhoto = {
  id: number;
  kind: EvidenceKind;
  url: string;
  width: number;
  height: number;
  status: EvidenceStatus;
  checkNote: string | null;
  checkedAt: string | null;
  createdAt: string;
  productId: number;
  productSlug: string;
  productName: string;
  productStatus: ProductStatus;
  materialKind: MaterialKind;
  metal: MetalType | null;
  /** Distinct finenesses of the live variants, ascending (e.g. 585). */
  finenesses: number[];
  /** Distinct weights of the live variants as decimal strings, ascending. */
  weightsGrams: string[];
  storeId: number;
  storeName: string;
};

export const REASON_MIN = 10;
export const REASON_MAX = 1000;

/** The backend needs a reason of 10+ characters for REJECTED; a VERIFIED note is optional. */
export const evidenceCheck = z
  .object({
    decision: z.enum(["VERIFIED", "REJECTED"]),
    reason: z.string().trim().max(REASON_MAX, "reasonTooLong").optional().default(""),
  })
  .refine((v) => v.decision !== "REJECTED" || v.reason.length >= REASON_MIN, {
    message: "reasonRequired",
    path: ["reason"],
  });

export type EvidenceCheck = z.infer<typeof evidenceCheck>;

export const pickEvidenceStatus = (raw: string): EvidenceStatus =>
  (EVIDENCE_STATUSES as readonly string[]).includes(raw) ? (raw as EvidenceStatus) : "PENDING";
