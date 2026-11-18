import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { adminCall } from "@/lib/admin/live";
import { conflict, readAdmin } from "@/lib/admin/server";
import { collectionOrderSchema } from "@/lib/admin/settings";

/**
 * PUT /api/v1/admin/collections/order: the new order of every occasion collection (#115).
 * Answers the list in that order. Demo: checks the role and the ids; nothing is stored.
 */
export async function PUT(request: Request) {
  const read = await readAdmin(request, collectionOrderSchema, { live: true });
  if (read instanceof Response) return read;
  const { ids } = read.data;
  if (!USING_MOCK)
    return adminCall(request, "/admin/collections/order", { method: "PUT", body: { ids } });
  const all = await adminApi.collections();
  const byId = new Map(all.map((c) => [c.id, c]));
  // A stale page that misses or invents a collection gets the same answer as from the API.
  if (ids.length !== all.length || ids.some((id) => !byId.has(id))) return conflict();
  return Response.json(ids.map((id, i) => ({ ...byId.get(id)!, sortOrder: (i + 1) * 10 })));
}
