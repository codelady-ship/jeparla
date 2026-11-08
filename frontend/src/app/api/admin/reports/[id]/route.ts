import { adminApi } from "@/lib/api/admin";
import { nextStatus } from "@/lib/admin/decisions";
import { conflict, notFound, readDecision } from "@/lib/admin/server";

/**
 * PATCH /api/v1/admin/reports/{id}/status: resolve a complaint, or dismiss it
 * with a reason. Demo: checks the role and the transition; nothing is stored.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const read = await readDecision(request, (await ctx.params).id);
  if (read instanceof Response) return read;
  const { id, decision } = read;
  const item = await adminApi.report(id);
  if (!item) return notFound();
  const status = nextStatus("report", item.status, decision.action);
  if (!status) return conflict();
  return Response.json({ id, status, note: decision.reason || null });
}
