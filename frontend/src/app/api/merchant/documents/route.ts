import { forwardJson } from "@/lib/api/forward";

/** Confirms an uploaded document with the seller declaration; 201 with the PENDING document. */
export const POST = (request: Request) =>
  forwardJson(request, "/merchant/documents", { status: 201 });
