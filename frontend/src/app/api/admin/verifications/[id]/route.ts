import { adminApi } from "@/lib/api/admin";
import { nextStatus } from "@/lib/admin/decisions";
import { conflict, notFound, readDecision } from "@/lib/admin/server";

/**
 * PATCH /api/v1/admin/verifications/{id}: grant or return a verification check.
 * Demo: checks the role and the transition and answers; nothing is stored yet.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/verifications/[id]">) {
  const read = await readDecision(request, (await ctx.params).id);
  if (read instanceof Response) return read;
  const { id, decision } = read;
  const item = await adminApi.verification(id);
  if (!item) return notFound();
  const status = nextStatus("check", item.status, decision.action);
  if (!status) return conflict();
  return Response.json({ id, status, note: decision.reason || null });
}
