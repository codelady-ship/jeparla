import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { adminCall } from "@/lib/admin/live";
import { fieldConflict, notFound, readAdmin, readId } from "@/lib/admin/server";
import { userStatusSchema } from "@/lib/admin/settings";

/**
 * PATCH: block or unblock an account (POST /api/v1/admin/users/{id}/status), with a reason
 * for the audit log. Nobody can block themselves or the last admin (409).
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const read = await readAdmin(request, userStatusSchema, { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  const { status, reason } = read.data;
  if (!USING_MOCK)
    return adminCall<{ id: number; status: string }>(request, `/admin/users/${id}/status`, {
      body: { status, reason },
      pick: (u) => ({ id: u.id, status: u.status }),
    });
  const user = (await adminApi.users()).find((u) => u.id === id);
  if (!user) return notFound();
  if (user.email?.toLowerCase() === read.session.email.toLowerCase())
    return fieldConflict("form", "self");
  if (user.status === status) return fieldConflict("form", "conflict");
  return Response.json({ id: user.id, status });
}
