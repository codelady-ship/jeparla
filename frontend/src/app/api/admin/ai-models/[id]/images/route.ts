import { forwardJson } from "@/lib/api/forward";
import { modelAttachSchema } from "@/lib/admin/ai-models";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/**
 * POST /api/v1/admin/ai-models/{id}/images (#130): attach an uploaded reference photo with
 * its pose. The backend checks the stored file (size, magic number, dimensions) first.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/ai-models/[id]/images">,
) {
  const read = await readAdmin(request, modelAttachSchema, { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  return forwardJson(request, `/admin/ai-models/${id}/images`, { body: read.data });
}
