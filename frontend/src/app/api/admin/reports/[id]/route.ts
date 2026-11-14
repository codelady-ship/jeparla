import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { nextStatus, REASON_MIN } from "@/lib/admin/decisions";
import { decideReport } from "@/lib/admin/live";
import { conflict, notFound, readDecision } from "@/lib/admin/server";

/**
 * PATCH: resolve or dismiss a complaint (POST /api/v1/admin/reports/{id}/resolution).
 * Both need a note of at least 10 characters for the audit log.
 * Demo: checks the role and the transition; nothing is stored.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const read = await readDecision(request, (await ctx.params).id, { live: true });
  if (read instanceof Response) return read;
  const { id, decision } = read;
  if (decision.reason.length < REASON_MIN)
    return Response.json({ errors: { reason: "reasonRequired" } }, { status: 400 });
  if (!USING_MOCK) return decideReport(request, id, decision);
  const item = await adminApi.report(id);
  if (!item) return notFound();
  const status = nextStatus("report", item.status, decision.action);
  if (!status) return conflict();
  return Response.json({ id, status, note: decision.reason });
}
