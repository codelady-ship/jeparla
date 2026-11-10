import { forwardJson } from "@/lib/api/forward";

/** Presigned upload of one verification document into private storage (#40). */
export const POST = (request: Request) => forwardJson(request, "/merchant/documents/uploads");
