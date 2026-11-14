import { z } from "zod";
import { USING_MOCK } from "@/lib/api";
import { unavailable } from "@/lib/auth/server";
import { adminCall } from "@/lib/admin/live";
import { notFound, readAdmin, readId } from "@/lib/admin/server";

/**
 * POST: a one-time password reset link for a seller who signed up with a phone only
 * (POST /api/v1/admin/users/{id}/password-reset-link). The admin passes it on by hand;
 * the link is answered once and never stored or logged here. Sample data has no
 * accounts to reset, so it answers "unavailable".
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (USING_MOCK) return unavailable();
  const read = await readAdmin(request, z.unknown(), { live: true });
  if (read instanceof Response) return read;
  const id = readId((await ctx.params).id);
  if (id === null) return notFound();
  const response = await adminCall(request, `/admin/users/${id}/password-reset-link`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
