import { adminApi } from "@/lib/api/admin";
import { fieldConflict, notFound, readAdmin, readId } from "@/lib/admin/server";
import { roleSchema } from "@/lib/admin/settings";

/**
 * PATCH /api/v1/admin/users/{id}/role. An admin can't change their own role,
 * and the last admin can't be demoted, so the panel never locks itself out.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const read = await readAdmin(request, roleSchema);
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  const users = await adminApi.users();
  const user = users.find((u) => u.id === id);
  if (!user) return notFound();
  const { role, reason } = read.data;
  if (user.email.toLowerCase() === read.session.email.toLowerCase())
    return fieldConflict("form", "self");
  if (user.role === role) return fieldConflict("role", "sameRole");
  if (user.role === "ADMIN" && users.filter((u) => u.role === "ADMIN").length === 1)
    return fieldConflict("form", "lastAdmin");
  return Response.json({ id: user.id, role, note: reason });
}
