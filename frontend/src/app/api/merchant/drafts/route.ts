import { forwardJson } from "@/lib/api/forward";

/** An uploaded photo becomes a private product draft (#129); 201 with the draft. */
export const POST = (request: Request) => forwardJson(request, "/merchant/drafts", { status: 201 });
