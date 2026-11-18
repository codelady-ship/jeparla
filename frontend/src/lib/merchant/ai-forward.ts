import { forwardJson } from "@/lib/api/forward";
import { aiErrorCode } from "./ai";

type ForwardOptions = NonNullable<Parameters<typeof forwardJson>[2]>;

/**
 * forwardJson for AI Studio calls: a failure with a known AI code (ai.quota,
 * ai.not_configured, ai.model_mismatch ...) answers that code as the form error, so the
 * studio shows its own message in the seller's language. Other failures stay as they are.
 */
export async function aiForward(
  request: Request,
  path: string,
  options: ForwardOptions = {},
): Promise<Response> {
  const res = await forwardJson(request, path, options);
  if (res.ok) return res;
  const data = (await res
    .clone()
    .json()
    .catch(() => null)) as { errors?: Record<string, string>; code?: string } | null;
  const code = aiErrorCode(data?.code);
  if (!code) return res;
  return Response.json({ errors: { ...data?.errors, form: code }, code }, { status: res.status });
}
