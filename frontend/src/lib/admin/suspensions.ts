import { z } from "zod";

/**
 * Four-eyes store suspension over a suspected forged document (#138, legal 3.1 and 2d).
 * Rejecting a document for AUTHENTICITY opens a request; only a second admin can confirm it
 * (the store is hidden and the seller notified) or dismiss it. Types follow backend
 * `StoreSuspensionDto`. Shared by the page, the list and the route handler.
 */

export const SUSPENSION_STATUSES = ["PENDING", "CONFIRMED", "DISMISSED"] as const;
export type SuspensionStatus = (typeof SUSPENSION_STATUSES)[number];

export type StoreSuspension = {
  id: number;
  storeId: number;
  storeName: string;
  /** The document that raised the suspicion (kept as evidence). */
  documentId: string | null;
  status: SuspensionStatus;
  requestedBy: number | null;
  requestedAt: string;
  /** Internal note of the admin who opened the request; never shown to the seller. */
  note: string | null;
  decidedBy: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export const NOTE_MAX = 1000;

export const suspensionDecision = z.object({
  decision: z.enum(["CONFIRM", "DISMISS"]),
  note: z.string().trim().max(NOTE_MAX, "tooLong").optional().default(""),
});

export type SuspensionDecision = z.infer<typeof suspensionDecision>;

export const pickSuspensionStatus = (raw: string): SuspensionStatus =>
  (SUSPENSION_STATUSES as readonly string[]).includes(raw) ? (raw as SuspensionStatus) : "PENDING";
