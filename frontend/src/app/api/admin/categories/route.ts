import { adminApi } from "@/lib/api/admin";
import { fieldConflict, readAdmin } from "@/lib/admin/server";
import { categorySchema } from "@/lib/admin/settings";

/**
 * POST /api/v1/admin/categories: a new category or subcategory.
 * Demo: checks the role, the form and the slug; nothing is stored yet.
 */
export async function POST(request: Request) {
  const read = await readAdmin(request, categorySchema);
  if (read instanceof Response) return read;
  const input = read.data;
  const all = await adminApi.categories();
  if (all.some((c) => c.slug === input.slug)) return fieldConflict("slug", "taken");
  if (input.parentId !== null && !all.some((c) => c.id === input.parentId && c.parentId === null))
    return fieldConflict("parentId", "invalid");
  const id = Math.max(0, ...all.map((c) => c.id)) + 1;
  return Response.json({ id, ...input, productCount: 0 }, { status: 201 });
}
