import { merchantApi } from "@/lib/api/merchant";
import { AUTH_AVAILABLE, readJson, unavailable } from "@/lib/auth/server";
import { toggledStatus } from "@/lib/merchant/filter";
import { statusChange } from "@/lib/merchant/schemas";
import { merchantOr401 } from "@/lib/merchant/server";

/**
 * PATCH /api/v1/merchant/products/{id}/status (demo): pause a live product or
 * put a paused one back. Products are never deleted (PLAN 5.2).
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/merchant/products/[id]/status">,
) {
  if (!AUTH_AVAILABLE) return unavailable();
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = Number((await ctx.params).id);
  const existing = Number.isInteger(id) ? await merchantApi(session).product(id) : null;
  if (!existing) return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = statusChange.safeParse(await readJson(request));
  if (!parsed.success || toggledStatus(existing.status) !== parsed.data.status)
    return Response.json({ error: "conflict" }, { status: 409 });
  return Response.json({ id, status: parsed.data.status });
}
