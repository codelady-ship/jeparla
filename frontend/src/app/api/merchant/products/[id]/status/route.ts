import { USING_MOCK } from "@/lib/api";
import { merchantApi } from "@/lib/api/merchant";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { readJson, requestLocale } from "@/lib/auth/server";
import { toggledStatus } from "@/lib/merchant/filter";
import { statusChange } from "@/lib/merchant/schemas";
import { merchantOr401 } from "@/lib/merchant/server";

/**
 * PATCH /api/v1/merchant/products/{id}/status: pause a live product or put a paused one
 * back. Products are never deleted (PLAN 5.2). The backend enforces the allowed transitions.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/merchant/products/[id]/status">,
) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = Number((await ctx.params).id);
  const parsed = statusChange.safeParse(await readJson(request));
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  if (!parsed.success) return Response.json({ error: "conflict" }, { status: 409 });
  if (!USING_MOCK) {
    try {
      const p = await userFetch<{ id: number; status: string }>(`/merchant/products/${id}/status`, {
        method: "PATCH",
        body: { status: parsed.data.status },
        canRefresh: true,
        locale: requestLocale(request),
      });
      return Response.json({ id: p.id, status: p.status });
    } catch (e) {
      return problemResponse(e);
    }
  }
  const existing = await merchantApi(session).product(id);
  if (!existing) return Response.json({ error: "not_found" }, { status: 404 });
  if (toggledStatus(existing.status) !== parsed.data.status)
    return Response.json({ error: "conflict" }, { status: 409 });
  return Response.json({ id, status: parsed.data.status });
}
