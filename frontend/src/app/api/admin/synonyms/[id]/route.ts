import { z } from "zod";
import { adminApi } from "@/lib/api/admin";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/** DELETE /api/v1/admin/search/synonyms/{id}. Demo: nothing is stored. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/synonyms/[id]">) {
  const read = await readAdmin(request, z.unknown());
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  const item = (await adminApi.synonyms()).find((g) => g.id === id);
  if (!item) return notFound();
  return Response.json({ id: item.id });
}
