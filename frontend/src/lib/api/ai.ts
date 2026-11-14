import type { Session } from "@/lib/auth/session";
import type { AiJob, AiModel, AiStatus, ModelAudience } from "@/types/ai";

/**
 * AI Studio reads (#55, #130): GET /api/v1/merchant/ai/status, /jobs?productId=
 * and /models?productId= (only models that fit the product's audience, #121: a
 * kids piece only on a child model). The backend checks the role and the
 * product's owner on every call.
 *
 * No AI provider is connected (owner decision), and the cabinet session carries
 * no API token until #41 wires the real backend. Until then this answers exactly
 * what the API answers without a provider and with an empty model library:
 * "not configured", no jobs, no models. It never shows sample or invented AI images.
 */
export interface AiStudioApi {
  status(): Promise<AiStatus>;
  jobs(productId: number): Promise<AiJob[]>;
  models(filter?: { productId?: number; audience?: ModelAudience }): Promise<AiModel[]>;
}

export const NOT_CONFIGURED: AiStatus = {
  configured: false,
  provider: "none",
  dailyLimit: 10,
  usedToday: 0,
  maxAttempts: 3,
  studioLook: false,
};

export function aiStudioApi(session: Session): AiStudioApi {
  void session;
  return {
    status: async () => NOT_CONFIGURED,
    jobs: async () => [],
    models: async () => [],
  };
}

/**
 * Admin reads of the model library (#130): GET /api/v1/admin/ai-models. Empty
 * until the admin uploads the first models through the real API (#41).
 */
export interface AdminAiModelsApi {
  list(): Promise<AiModel[]>;
}

export function adminAiModelsApi(session: Session): AdminAiModelsApi {
  void session;
  return { list: async () => [] };
}
