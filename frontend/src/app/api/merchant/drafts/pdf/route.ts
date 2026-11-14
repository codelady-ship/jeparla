import { forwardJson } from "@/lib/api/forward";

/** The uploaded catalog PDF becomes one draft per photo (#129); reading it can take a while. */
export const POST = (request: Request) =>
  forwardJson(request, "/merchant/drafts/pdf", { timeoutMs: 90_000 });
