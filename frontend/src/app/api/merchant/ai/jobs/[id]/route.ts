import { USING_MOCK } from "@/lib/api";
import { aiStudioApi } from "@/lib/api/ai";
import { readJson } from "@/lib/auth/server";
import { aiJobAction } from "@/lib/merchant/ai";
import { aiForward } from "@/lib/merchant/ai-forward";
import { merchantOr401 } from "@/lib/merchant/server";

/**
 * Approve, reject, retry or delete one job (#55): POST /api/v1/merchant/ai/jobs/{id}/approve,
 * /reject, /retry and DELETE /jobs/{id}. The backend checks that the job belongs to the
 * seller's store and that the job is in the right state (409 ai.job_state otherwise).
 * With the sample data no job exists, so every action is 503 or 404.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/merchant/ai/jobs/[id]">) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = Number((await ctx.params).id);
  const parsed = aiJobAction.safeParse(await readJson(request));
  if (!Number.isInteger(id) || id <= 0 || !parsed.success)
    return Response.json({ errors: { form: "server" } }, { status: 400 });
  if (!USING_MOCK) {
    const action = parsed.data;
    if (action.action === "delete")
      return aiForward(request, `/merchant/ai/jobs/${id}`, { method: "DELETE" });
    return aiForward(request, `/merchant/ai/jobs/${id}/${action.action}`, {
      body: action.action === "approve" ? { assetId: action.assetId } : {},
    });
  }
  const status = await aiStudioApi(session).status();
  if (!status.configured)
    return Response.json({ errors: { form: "ai.not_configured" } }, { status: 503 });
  return Response.json({ error: "not_found" }, { status: 404 });
}
