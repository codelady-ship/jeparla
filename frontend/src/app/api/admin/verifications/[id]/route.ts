import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { decisionSchema, nextStatus } from "@/lib/admin/decisions";
import { decideDocument } from "@/lib/admin/live";
import { conflict, notFound, readAdmin } from "@/lib/admin/server";

/** Demo request ids are numbers; real ones are document UUIDs. */
const ID = /^(\d{1,9}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * PATCH: grant (verify), return (the seller uploads again) or reject a verification
 * document. Returning and rejecting need a reason code and a note for the seller.
 * Demo: checks the role and the transition and answers; nothing is stored.
 * Real API: POST /api/v1/admin/documents/{id}/decision; the store gets its Jeparla
 * Verified badge only from there.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/verifications/[id]">) {
  const id = (await ctx.params).id;
  const read = await readAdmin(request, decisionSchema, { live: true });
  if (read instanceof Response) return read;
  if (!ID.test(id)) return notFound();
  if (!USING_MOCK) return decideDocument(request, id, read.data);
  const item = await adminApi.verification(id);
  if (!item) return notFound();
  const status = nextStatus("check", item.status, read.data.action);
  if (!status) return conflict();
  return Response.json({ id, status, note: read.data.reason || null });
}
