import { userFetch } from "@/lib/auth/backend";
import type { MerchantDraft } from "@/lib/merchant/bulk";
import { USING_MOCK } from "./mode";

/** GET /merchant/drafts (server components). No drafts with the sample data. */
export const merchantDrafts = (): Promise<MerchantDraft[]> =>
  USING_MOCK ? Promise.resolve([]) : userFetch("/merchant/drafts");
