import { forwardJson } from "@/lib/api/forward";

/** Price mode and/or labour per gram of up to 100 own products, each on its own (#109). */
export const POST = (request: Request) =>
  forwardJson(request, "/merchant/products/bulk-pricing", { timeoutMs: 30_000 });
