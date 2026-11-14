import { z } from "zod";
import { AI_ERROR_CODES, AI_JOB_KINDS, type AiErrorCode, type AiJobStatus } from "@/types/ai";

/** Body of POST /api/merchant/ai/jobs, same fields as the backend AiJobRequest. */
export const aiJobRequest = z.object({
  productId: z.number().int().positive(),
  sourceImageId: z.union([z.number().int().positive(), z.string().min(1).max(64)]),
  kind: z.enum(AI_JOB_KINDS),
});

/** Seller actions on one job (POST /api/merchant/ai/jobs/[id]). */
export const aiJobAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), assetId: z.number().int().positive() }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("retry") }),
  z.object({ action: z.literal("delete") }),
]);

/** A known code, so the UI shows its message; anything else is a generic failure. */
export function aiErrorCode(code: string | undefined): AiErrorCode | null {
  return code && (AI_ERROR_CODES as readonly string[]).includes(code)
    ? (code as AiErrorCode)
    : null;
}

/** The job still changes on its own (queued or running at the provider). */
export function isRunning(status: AiJobStatus): boolean {
  return status === "QUEUED" || status === "PROCESSING";
}

/** Quota left today, never negative. */
export function quotaLeft(dailyLimit: number, usedToday: number): number {
  return Math.max(0, dailyLimit - usedToday);
}
