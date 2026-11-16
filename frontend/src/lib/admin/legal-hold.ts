import { z } from "zod";

/** Reason of a legal hold (#138, #249): as the backend and the database check it (V56). */
export const LEGAL_HOLD_REASON_MIN = 10;
export const LEGAL_HOLD_REASON_MAX = 500;

/** Place (hold true, with the reason) or release (hold false) a store's legal hold. */
export const legalHoldSchema = z.discriminatedUnion("hold", [
  z.object({
    hold: z.literal(true),
    reason: z
      .string()
      .trim()
      .min(LEGAL_HOLD_REASON_MIN, "reasonRequired")
      .max(LEGAL_HOLD_REASON_MAX, "reasonTooLong"),
  }),
  z.object({ hold: z.literal(false) }),
]);

/** GET/POST /api/v1/admin/stores/{id}/legal-hold (backend LegalHoldDto); both null without a hold. */
export type LegalHold = {
  storeId: number;
  legalHoldAt: string | null;
  legalHoldReason: string | null;
};
