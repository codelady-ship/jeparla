import { USING_MOCK } from "@/lib/api";
import { aiStudioApi } from "@/lib/api/ai";
import { merchantApi } from "@/lib/api/merchant";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { readJson, requestLocale } from "@/lib/auth/server";
import { aiJobRequest } from "@/lib/merchant/ai";
import { aiForward } from "@/lib/merchant/ai-forward";
import { merchantOr401 } from "@/lib/merchant/server";
import type { AiJob } from "@/types/ai";

/**
 * GET /api/v1/merchant/ai/jobs?productId=: the studio asks again while a job is queued
 * or running. The backend answers only for the seller's own product.
 */
export async function GET(request: Request) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const productId = Number(new URL(request.url).searchParams.get("productId"));
  if (!Number.isInteger(productId) || productId <= 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  if (USING_MOCK) return Response.json(await aiStudioApi(session).jobs(productId));
  try {
    const jobs = await userFetch<AiJob[]>("/merchant/ai/jobs", {
      query: { productId },
      canRefresh: true,
      locale: requestLocale(request),
    });
    return Response.json(jobs);
  } catch (e) {
    return problemResponse(e);
  }
}

/**
 * POST /api/v1/merchant/ai/jobs (#55). Ownership first, then the provider: without
 * one the answer is 503 ai.not_configured, as from the backend. Nothing is queued
 * and no image is made. The backend checks the store's daily quota and the model.
 */
export async function POST(request: Request) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const parsed = aiJobRequest.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: { form: "server" } }, { status: 400 });
  if (!USING_MOCK)
    return aiForward(request, "/merchant/ai/jobs", { body: parsed.data, status: 201 });
  const product = await merchantApi(session).product(parsed.data.productId);
  if (!product) return Response.json({ error: "not_found" }, { status: 404 });
  const source = String(parsed.data.sourceImageId);
  if (!product.input.images.some((img) => String(img.id) === source))
    return Response.json({ errors: { form: "ai.source_image" } }, { status: 400 });
  const status = await aiStudioApi(session).status();
  if (!status.configured)
    return Response.json({ errors: { form: "ai.not_configured" } }, { status: 503 });
  return Response.json({ errors: { form: "server" } }, { status: 500 });
}
