import { forwardJson } from "@/lib/api/forward";

/** A new share code for the own store (#100); the old link and printed QR codes stop working. */
export const POST = (request: Request) =>
  forwardJson(request, "/merchant/store/share/regenerate", { body: null });
