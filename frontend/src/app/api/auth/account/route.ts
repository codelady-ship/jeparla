import { z } from "zod";
import { USING_MOCK } from "@/lib/api";
import { problemResponse } from "@/lib/api/problem";
import { endSession, userFetch } from "@/lib/auth/backend";
import { readJson, readSession, requestLocale } from "@/lib/auth/server";

const body = z.object({ password: z.string().min(1, "required").max(128, "required") });

/**
 * DELETE: the signed-in user deletes their own account (#249) with the password again
 * (DELETE /api/v1/auth/me). On success the session cookies go too. The sample data has no
 * accounts to delete: 503 there, nothing is pretended.
 */
export async function DELETE(request: Request) {
  const session = await readSession();
  if (!session) return Response.json({ errors: { form: "sessionExpired" } }, { status: 401 });
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: { password: "required" } }, { status: 400 });
  if (USING_MOCK) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  try {
    await userFetch("/auth/me", {
      method: "DELETE",
      body: parsed.data,
      canRefresh: true,
      locale: requestLocale(request),
    });
  } catch (e) {
    return problemResponse(e);
  }
  await endSession();
  return new Response(null, { status: 204 });
}
