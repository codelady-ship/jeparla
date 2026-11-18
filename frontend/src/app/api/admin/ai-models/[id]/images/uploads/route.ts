import { forwardJson } from "@/lib/api/forward";
import { modelUploadSchema } from "@/lib/admin/ai-models";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/**
 * POST /api/v1/admin/ai-models/{id}/images/uploads (#130): a short-lived presigned URL
 * for one reference photo. The browser sends the file straight to storage, then attaches it.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/ai-models/[id]/images/uploads">,
) {
  const read = await readAdmin(request, modelUploadSchema, { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  return forwardJson(request, `/admin/ai-models/${id}/images/uploads`, { body: read.data });
}
