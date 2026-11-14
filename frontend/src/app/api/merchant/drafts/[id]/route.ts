import { forwardJson } from "@/lib/api/forward";

/** Deletes a draft and its photo; the backend checks that the draft is the seller's own. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/merchant/drafts/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  return forwardJson(request, `/merchant/drafts/${id}`, { method: "DELETE" });
}
