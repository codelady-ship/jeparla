import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { adminCall } from "@/lib/admin/live";
import { fieldConflict, notFound, readAdmin, readId } from "@/lib/admin/server";
import { collectionSchema } from "@/lib/admin/settings";

/**
 * PUT /api/v1/admin/collections/{id}: rename, hide or show an occasion collection (#115).
 * Demo: checks the role, the form and the slug; nothing is stored.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/collections/[id]">) {
  const read = await readAdmin(request, collectionSchema, { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  const input = read.data;
  if (!USING_MOCK)
    return adminCall(request, `/admin/collections/${id}`, { method: "PUT", body: input });
  const all = await adminApi.collections();
  const item = all.find((c) => c.id === id);
  if (!item) return notFound();
  if (all.some((c) => c.id !== id && c.slug === input.slug)) return fieldConflict("slug", "taken");
  return Response.json({ ...item, ...input });
}
