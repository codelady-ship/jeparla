import { forwardJson } from "@/lib/api/forward";
import { aiModelSchema } from "@/lib/admin/ai-models";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/**
 * PUT /api/v1/admin/ai-models/{id} (#130): change a model, reorder it, or deactivate it
 * (`active: false`). A model is never deleted: a deactivated one leaves new jobs, images
 * approved earlier stay on their products.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/ai-models/[id]">) {
  const read = await readAdmin(request, aiModelSchema, { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  return forwardJson(request, `/admin/ai-models/${id}`, { method: "PUT", body: read.data });
}
