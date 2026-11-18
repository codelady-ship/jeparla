import { z } from "zod";
import { forwardJson } from "@/lib/api/forward";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/** POST /api/v1/admin/ai-models/{id}/default (#130): the default model of its audience. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/ai-models/[id]/default">,
) {
  const read = await readAdmin(request, z.unknown(), { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  return forwardJson(request, `/admin/ai-models/${id}/default`, { body: {} });
}
