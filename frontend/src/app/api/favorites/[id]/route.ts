import { forwardJson } from "@/lib/api/forward";

/**
 * Saves or removes one favourite in the signed-in buyer's account (#112). The backend
 * keeps the price of that moment and always uses the token's own list.
 */
async function forward(
  request: Request,
  ctx: RouteContext<"/api/favorites/[id]">,
  method: "PUT" | "DELETE",
) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  return forwardJson(request, `/favorites/${id}`, {
    method,
    body: method === "PUT" ? null : undefined,
  });
}

export const PUT = (request: Request, ctx: RouteContext<"/api/favorites/[id]">) =>
  forward(request, ctx, "PUT");

export const DELETE = (request: Request, ctx: RouteContext<"/api/favorites/[id]">) =>
  forward(request, ctx, "DELETE");
