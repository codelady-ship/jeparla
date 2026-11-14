import { forwardJson } from "@/lib/api/forward";

/** Status change of up to 100 own products, each on its own (#109). */
export const POST = (request: Request) =>
  forwardJson(request, "/merchant/products/bulk-status", { timeoutMs: 30_000 });
