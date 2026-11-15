import { USING_MOCK } from "@/lib/api/mode";
import { evidenceCheck } from "@/lib/admin/evidence";
import { adminCall } from "@/lib/admin/live";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/**
 * POST: VERIFIED (the photo matches the product data) or REJECTED with a reason (#106).
 * The backend refuses a photo of the admin's own store (403) and writes the audit log.
 * No sample-data version: a check is never pretended.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/evidence-photos/[id]/check">,
) {
  if (USING_MOCK) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  const id = readId((await ctx.params).id);
  const read = await readAdmin(request, evidenceCheck, { live: true });
  if (read instanceof Response) return read;
  if (id === null) return notFound();
  return adminCall(request, `/admin/evidence-photos/${id}/check`, {
    body: { decision: read.data.decision, reason: read.data.reason || null },
  });
}
