import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { toAdminUser } from "@/lib/api/admin-http";
import { adminCall } from "@/lib/admin/live";
import { fieldConflict, notFound, readAdmin, readId } from "@/lib/admin/server";
import { roleSchema } from "@/lib/admin/settings";

/**
 * PATCH: change a role (POST /api/v1/admin/users/{id}/role). An admin can't change their
 * own role, and the last admin can't be demoted, so the panel never locks itself out; the
 * backend refuses both (409) and the panel says why.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const read = await readAdmin(request, roleSchema, { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  const { role, reason } = read.data;
  if (!USING_MOCK)
    return adminCall<Parameters<typeof toAdminUser>[0], { id: number; role: string }>(
      request,
      `/admin/users/${id}/role`,
      { body: { role, reason }, pick: (u) => ({ id: u.id, role: toAdminUser(u).role }) },
    );
  const users = await adminApi.users();
  const user = users.find((u) => u.id === id);
  if (!user) return notFound();
  if (user.email?.toLowerCase() === read.session.email.toLowerCase())
    return fieldConflict("form", "self");
  if (user.role === role) return fieldConflict("role", "sameRole");
  if (user.role === "ADMIN" && users.filter((u) => u.role === "ADMIN").length === 1)
    return fieldConflict("form", "lastAdmin");
  return Response.json({ id: user.id, role, note: reason });
}
