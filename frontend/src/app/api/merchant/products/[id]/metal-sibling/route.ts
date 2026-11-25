import { z } from "zod";
import { USING_MOCK } from "@/lib/api";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { readJson, requestLocale } from "@/lib/auth/server";
import type { MetalSiblings } from "@/lib/merchant/metal-sibling";
import { merchantOr401 } from "@/lib/merchant/server";

const body = z.object({ siblingId: z.number().int().positive().nullable() });

/**
 * PUT /api/v1/merchant/products/{id}/metal-sibling: link the same design in another metal, or
 * unlink with null (V70). The backend checks the owner, the store, the kind and the metals.
 * The sample data has no links, so there it only answers like the backend would.
 */
export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/merchant/products/[id]/metal-sibling">,
) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: { form: "invalid" } }, { status: 400 });
  if (USING_MOCK) return Response.json({ siblingId: parsed.data.siblingId, options: [] });
  try {
    return Response.json(
      await userFetch<MetalSiblings>(`/merchant/products/${id}/metal-sibling`, {
        method: "PUT",
        body: parsed.data,
        canRefresh: true,
        locale: requestLocale(request),
      }),
    );
  } catch (e) {
    return problemResponse(e);
  }
}
