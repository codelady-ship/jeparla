/**
 * AI Studio (#55): GET /api/v1/merchant/ai/status and /jobs. Mirrors
 * backend az.jeparla.ai.dto. No provider ships with the site: until the owner
 * connects one, `configured` is false and job requests answer 503.
 */
export type AiJobKind = "AI_PHOTOSHOOT" | "VIRTUAL_TRY_ON";

export type AiJobStatus =
  "QUEUED" | "PROCESSING" | "REVIEW_REQUIRED" | "APPROVED" | "FAILED" | "CANCELLED";

export type AiStatus = {
  configured: boolean;
  provider: string;
  dailyLimit: number;
  usedToday: number;
  maxAttempts: number;
};

export type AiAsset = {
  id: number;
  /** Short-lived private URL while the job waits for review, else null. */
  previewUrl: string | null;
  width: number;
  height: number;
  productImageId: number | null;
};

export type AiJob = {
  id: number;
  productId: number;
  sourceImageId: number | null;
  kind: AiJobKind;
  status: AiJobStatus;
  attempts: number;
  maxAttempts: number;
  errorCode: string | null;
  canRetry: boolean;
  createdAt: string;
  updatedAt: string;
  assets: AiAsset[];
};

export const AI_JOB_KINDS: readonly AiJobKind[] = ["AI_PHOTOSHOOT", "VIRTUAL_TRY_ON"];

/** Error codes the API may return or store on a job; each has a message in Merchant.ai.errors. */
export const AI_ERROR_CODES = [
  "ai.not_configured",
  "ai.cost_limit",
  "ai.provider_error",
  "ai.provider_refused",
  "ai.timeout",
  "ai.bad_result",
  "ai.source_gone",
  "ai.job_state",
  "ai.no_attempts_left",
  "ai.source_image",
  "ai.source_ai_generated",
  "ai.quota",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];
