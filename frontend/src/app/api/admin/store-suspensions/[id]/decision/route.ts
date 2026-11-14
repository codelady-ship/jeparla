import { USING_MOCK } from "@/lib/api/mode";
import { adminCall } from "@/lib/admin/live";
import { notFound, readAdmin, readId } from "@/lib/admin/server";
import { suspensionDecision } from "@/lib/admin/suspensions";

/**
 * POST: the second admin confirms (the store is hidden, the seller notified) or dismisses a
 * suspension request (#138). The backend refuses the admin who opened it (409
 * verification.four_eyes) and a request decided already (409). The note stays in the audit log.
 * No sample-data version: a suspension is never pretended.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/store-suspensions/[id]/decision">,
) {
  if (USING_MOCK) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  const id = readId((await ctx.params).id);
  const read = await readAdmin(request, suspensionDecision, { live: true });
  if (read instanceof Response) return read;
  if (id === null) return notFound();
  return adminCall(request, `/admin/store-suspensions/${id}/decision`, {
    body: { decision: read.data.decision, note: read.data.note || null },
  });
}
