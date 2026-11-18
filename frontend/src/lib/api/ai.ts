import { userFetch } from "@/lib/auth/backend";
import type { Session } from "@/lib/auth/session";
import type { AiJob, AiModel, AiStatus, ModelAudience } from "@/types/ai";
import { USING_MOCK } from "./mode";

/**
 * AI Studio reads (#55, #130): GET /api/v1/merchant/ai/status, /jobs?productId=
 * and /models?productId= (only models that fit the product's audience, #121: a
 * kids piece only on a child model). The backend checks the role and the
 * product's owner on every call.
 *
 * No AI provider ships with the site (owner decision): until the owner sets one in
 * the backend env, the real API answers `configured: false` and the studio says so.
 * With the sample data there is no backend, and this answers exactly what the API
 * answers without a provider and with an empty model library: "not configured",
 * no jobs, no models. It never shows sample or invented AI images.
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

const sampleAiStudioApi: AiStudioApi = {
  status: async () => NOT_CONFIGURED,
  jobs: async () => [],
  models: async () => [],
};

const httpAiStudioApi: AiStudioApi = {
  status: () => userFetch<AiStatus>("/merchant/ai/status"),
  jobs: (productId) => userFetch<AiJob[]>("/merchant/ai/jobs", { query: { productId } }),
  models: (filter = {}) => userFetch<AiModel[]>("/merchant/ai/models", { query: filter }),
};

export function aiStudioApi(session: Session): AiStudioApi {
  void session;
  return USING_MOCK ? sampleAiStudioApi : httpAiStudioApi;
}

/**
 * Admin reads of the model library (#130): GET /api/v1/admin/ai-models, every
 * model with the inactive ones. Empty with the sample data: no model is invented.
 */
export interface AdminAiModelsApi {
  list(): Promise<AiModel[]>;
}

export function adminAiModelsApi(session: Session): AdminAiModelsApi {
  void session;
  return USING_MOCK
    ? { list: async () => [] }
    : { list: () => userFetch<AiModel[]>("/admin/ai-models") };
}
