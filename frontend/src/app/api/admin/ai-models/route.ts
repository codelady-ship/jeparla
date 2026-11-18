import { forwardJson } from "@/lib/api/forward";
import { aiModelSchema } from "@/lib/admin/ai-models";
import { readAdmin } from "@/lib/admin/server";

/**
 * POST /api/v1/admin/ai-models (#130): add an AI model (not a real person) to the library.
 * It starts active and without photos; the backend checks the ADMIN role and audits it.
 * With the sample data there is no backend: 503, nothing is pretended saved.
 */
export async function POST(request: Request) {
  const read = await readAdmin(request, aiModelSchema, { live: true });
  if (read instanceof Response) return read;
  return forwardJson(request, "/admin/ai-models", { body: read.data, status: 201 });
}
