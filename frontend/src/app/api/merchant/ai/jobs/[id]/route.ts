import { USING_MOCK } from "@/lib/api";
import { aiStudioApi } from "@/lib/api/ai";
import { readJson, unavailable } from "@/lib/auth/server";
import { aiJobAction } from "@/lib/merchant/ai";
import { merchantOr401 } from "@/lib/merchant/server";

/**
 * Approve, reject, retry or delete one job (#55): POST /api/v1/merchant/ai/jobs/{id}/approve
 * and the others. Without a provider no job exists, so every action is 503 or 404.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/merchant/ai/jobs/[id]">) {
  if (!USING_MOCK) return unavailable();
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = Number((await ctx.params).id);
  const parsed = aiJobAction.safeParse(await readJson(request));
  if (!Number.isInteger(id) || !parsed.success)
    return Response.json({ errors: { form: "server" } }, { status: 400 });
  const status = await aiStudioApi(session).status();
  if (!status.configured)
    return Response.json({ errors: { form: "ai.not_configured" } }, { status: 503 });
  return Response.json({ error: "not_found" }, { status: 404 });
}
