import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { adminCall } from "@/lib/admin/live";
import { fieldConflict, readAdmin } from "@/lib/admin/server";
import { collectionSchema } from "@/lib/admin/settings";

/**
 * POST /api/v1/admin/collections: a new occasion collection (#115), placed after the last one.
 * Demo: checks the role, the form and the slug; nothing is stored.
 */
export async function POST(request: Request) {
  const read = await readAdmin(request, collectionSchema, { live: true });
  if (read instanceof Response) return read;
  const input = read.data;
  if (!USING_MOCK) return adminCall(request, "/admin/collections", { body: input, status: 201 });
  const all = await adminApi.collections();
  if (all.some((c) => c.slug === input.slug)) return fieldConflict("slug", "taken");
  const id = Math.max(0, ...all.map((c) => c.id)) + 1;
  const sortOrder = Math.max(0, ...all.map((c) => c.sortOrder)) + 10;
  return Response.json({ id, ...input, sortOrder, productCount: 0 }, { status: 201 });
}
