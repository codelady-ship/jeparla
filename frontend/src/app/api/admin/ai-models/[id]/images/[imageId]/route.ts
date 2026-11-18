import { z } from "zod";
import { forwardJson } from "@/lib/api/forward";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/** DELETE /api/v1/admin/ai-models/{id}/images/{imageId} (#130): remove one reference photo. */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/admin/ai-models/[id]/images/[imageId]">,
) {
  const read = await readAdmin(request, z.unknown(), { live: true });
  if (read instanceof Response) return read;
  const params = await ctx.params;
  const id = readId(params.id);
  const imageId = readId(params.imageId);
  if (id === null || imageId === null) return notFound();
  return forwardJson(request, `/admin/ai-models/${id}/images/${imageId}`, { method: "DELETE" });
}
