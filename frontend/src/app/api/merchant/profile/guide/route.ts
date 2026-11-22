import { forwardJson } from "@/lib/api/forward";
import { USING_MOCK } from "@/lib/api/mode";

/**
 * The seller closed the cabinet's first-visit guide (#301): kept on the account, not the browser.
 * With the sample data there is no account to keep it on; the browser copy is enough there.
 */
export const POST = (request: Request) =>
  USING_MOCK
    ? new Response(null, { status: 204 })
    : forwardJson(request, "/merchant/store/guide-dismissal", { body: null });
