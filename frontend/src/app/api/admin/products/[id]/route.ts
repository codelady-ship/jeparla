import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { decideProduct } from "@/lib/admin/live";
import { nextStatus } from "@/lib/admin/decisions";
import { conflict, notFound, readDecision } from "@/lib/admin/server";

/**
 * PATCH /api/v1/admin/products/{id}/status: approve, return or take down a product.
 * Demo: checks the role and the transition and answers; nothing is stored.
 * Real API: the backend decides, logs and notifies the seller.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  const read = await readDecision(request, (await ctx.params).id, { live: true });
  if (read instanceof Response) return read;
  const { id, decision } = read;
  if (!USING_MOCK) return decideProduct(request, id, decision);
  const item = await adminApi.product(id);
  if (!item) return notFound();
  const status = nextStatus("product", item.status, decision.action);
  if (!status) return conflict();
  return Response.json({ id, status, note: decision.reason || null });
}
