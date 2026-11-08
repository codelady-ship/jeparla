import { adminApi } from "@/lib/api/admin";
import { nextStatus } from "@/lib/admin/decisions";
import { conflict, notFound, readDecision } from "@/lib/admin/server";

/**
 * PATCH /api/v1/admin/stores/{id}/status: approve, reject, block or unblock a store.
 * Demo: checks the role and the transition and answers; nothing is stored yet.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/stores/[id]">) {
  const read = await readDecision(request, (await ctx.params).id);
  if (read instanceof Response) return read;
  const { id, decision } = read;
  const item = await adminApi.store(id);
  if (!item) return notFound();
  const status = nextStatus("store", item.status, decision.action);
  if (!status) return conflict();
  return Response.json({ id, status, note: decision.reason || null });
}
