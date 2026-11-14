import { forwardJson } from "@/lib/api/forward";

/** Presigned upload of one draft photo or one catalog PDF into private storage (#129). */
export const POST = (request: Request) => forwardJson(request, "/merchant/drafts/uploads");
