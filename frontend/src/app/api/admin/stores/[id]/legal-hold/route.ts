import { USING_MOCK } from "@/lib/api";
import { adminCall } from "@/lib/admin/live";
import { legalHoldSchema } from "@/lib/admin/legal-hold";
import { notFound, readAdmin, readId } from "@/lib/admin/server";
import { readSession } from "@/lib/auth/server";

const unavailable = () => Response.json({ errors: { form: "unavailable" } }, { status: 503 });

/**
 * Legal hold of a store's evidence (#138, #249), on the real API only: a hold is never
 * pretended in the sample data. GET reads it with the reason, POST places or releases it;
 * the backend checks the ADMIN role and writes LEGAL_HOLD_PLACED / LEGAL_HOLD_RELEASED.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/admin/stores/[id]/legal-hold">,
) {
  if (USING_MOCK) return unavailable();
  const session = await readSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: 403 });
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  return adminCall(request, `/admin/stores/${id}/legal-hold`, { method: "GET" });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/stores/[id]/legal-hold">,
) {
  if (USING_MOCK) return unavailable();
  const read = await readAdmin(request, legalHoldSchema, { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  return adminCall(request, `/admin/stores/${id}/legal-hold`, { body: read.data });
}
