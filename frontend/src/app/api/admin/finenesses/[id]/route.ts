import { z } from "zod";
import { adminApi } from "@/lib/api/admin";
import { fieldConflict, notFound, readAdmin, readId } from "@/lib/admin/server";

/** DELETE /api/v1/admin/finenesses/{id}: refused while any variant uses it. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/finenesses/[id]">) {
  const read = await readAdmin(request, z.unknown());
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  const item = (await adminApi.finenesses()).find((f) => f.id === id);
  if (!item) return notFound();
  if (item.productCount > 0) return fieldConflict("form", "inUse");
  return Response.json({ id: item.id });
}
