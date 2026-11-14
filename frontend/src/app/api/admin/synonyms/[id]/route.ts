import { z } from "zod";
import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { adminCall } from "@/lib/admin/live";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/** DELETE /api/v1/admin/synonyms/{id}. Demo: nothing is stored. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/synonyms/[id]">) {
  const read = await readAdmin(request, z.unknown(), { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  if (!USING_MOCK) return adminCall(request, `/admin/synonyms/${id}`, { method: "DELETE" });
  const item = (await adminApi.synonyms()).find((p) => p.id === id);
  if (!item) return notFound();
  return Response.json({ id: item.id });
}
