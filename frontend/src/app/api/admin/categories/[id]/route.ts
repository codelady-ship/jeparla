import { z } from "zod";
import { adminApi } from "@/lib/api/admin";
import { fieldConflict, notFound, readAdmin, readId } from "@/lib/admin/server";

/**
 * DELETE /api/v1/admin/categories/{id}: only an empty category without
 * subcategories can go, so no product is left without a place in the catalog.
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/categories/[id]">) {
  const read = await readAdmin(request, z.unknown());
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  const all = await adminApi.categories();
  const item = all.find((c) => c.id === id);
  if (!item) return notFound();
  if (item.productCount > 0 || all.some((c) => c.parentId === item.id))
    return fieldConflict("form", "inUse");
  return Response.json({ id: item.id });
}
