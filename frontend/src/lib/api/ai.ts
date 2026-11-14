import type { Session } from "@/lib/auth/session";
import type { AiJob, AiStatus } from "@/types/ai";

/**
 * AI Studio reads (#55): GET /api/v1/merchant/ai/status and /jobs?productId=.
 * The backend checks the role and the product's owner on every call.
 *
 * No AI provider is connected (owner decision), and the cabinet session carries
 * no API token until #41 wires the real backend. Until then this answers exactly
 * what the API answers without a provider: "not configured" and no jobs. It never
 * shows sample or invented AI images.
 */
export interface AiStudioApi {
  status(): Promise<AiStatus>;
  jobs(productId: number): Promise<AiJob[]>;
}

export const NOT_CONFIGURED: AiStatus = {
  configured: false,
  provider: "none",
  dailyLimit: 10,
  usedToday: 0,
  maxAttempts: 3,
};

export function aiStudioApi(session: Session): AiStudioApi {
  void session;
  return {
    status: async () => NOT_CONFIGURED,
    jobs: async () => [],
  };
}
