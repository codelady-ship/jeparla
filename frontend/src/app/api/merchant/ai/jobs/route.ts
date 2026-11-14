import { USING_MOCK } from "@/lib/api";
import { aiStudioApi } from "@/lib/api/ai";
import { merchantApi } from "@/lib/api/merchant";
import { readJson, unavailable } from "@/lib/auth/server";
import { aiJobRequest } from "@/lib/merchant/ai";
import { merchantOr401 } from "@/lib/merchant/server";

/**
 * POST /api/v1/merchant/ai/jobs (#55). Ownership first, then the provider: without
 * one the answer is 503 ai.not_configured, as from the backend. Nothing is queued
 * and no image is made.
 */
export async function POST(request: Request) {
  if (!USING_MOCK) return unavailable();
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const parsed = aiJobRequest.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: { form: "server" } }, { status: 400 });
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
