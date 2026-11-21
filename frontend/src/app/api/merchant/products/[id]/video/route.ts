import { USING_MOCK } from "@/lib/api";
import { merchantApi } from "@/lib/api/merchant";
import { problemResponse } from "@/lib/api/problem";
import { requestLocale } from "@/lib/auth/server";
import { removeVideo, saveVideo } from "@/lib/merchant/save-video";
import { merchantOr401 } from "@/lib/merchant/server";
import { isVideoType, VIDEO_MAX_BYTES, type MerchantVideo } from "@/lib/merchant/video";

type Ctx = RouteContext<"/api/merchant/products/[id]/video">;

const productId = async (ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const problem = (form: string, status: number) => Response.json({ errors: { form } }, { status });

/**
 * POST: the short video of a product (#117). The body is the file itself (not JSON: a clip is
 * up to 8 MB), `Content-Type` its type and `?ai=1` the "made with AI" mark. Type and size are
 * checked here to stop a wasted transfer; the API checks the stored file (container, codec,
 * duration) and the ownership of the product, and its refusal comes back in the page language.
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = await productId(ctx);
  if (id === null) return Response.json({ error: "not_found" }, { status: 404 });
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!isVideoType(type)) return problem("videoType", 400);
  if (Number(request.headers.get("content-length") ?? 0) > VIDEO_MAX_BYTES)
    return problem("videoSize", 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > VIDEO_MAX_BYTES)
    return problem("videoSize", 400);
  const aiGenerated = new URL(request.url).searchParams.get("ai") === "1";
  if (!USING_MOCK) {
    try {
      return Response.json(
        await saveVideo(id, { type, bytes }, aiGenerated, requestLocale(request)),
      );
    } catch (e) {
      return problemResponse(e);
    }
  }
  // Sample data keeps no files: the answer is the sample clip, so the form can be tried.
  if (!(await merchantApi(session).product(id)))
    return Response.json({ error: "not_found" }, { status: 404 });
  const sample: MerchantVideo = {
    url: "/demo/ring-video.mp4",
    contentType: "video/mp4",
    sizeBytes: bytes.byteLength,
    durationMs: 7920,
    width: 480,
    height: 600,
    aiGenerated,
  };
  return Response.json(sample);
}

/** DELETE: removes the video; the API deletes the file. */
export async function DELETE(request: Request, ctx: Ctx) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = await productId(ctx);
  if (id === null) return Response.json({ error: "not_found" }, { status: 404 });
  if (!USING_MOCK) {
    try {
      await removeVideo(id, requestLocale(request));
    } catch (e) {
      return problemResponse(e);
    }
  }
  return Response.json({ ok: true });
}
