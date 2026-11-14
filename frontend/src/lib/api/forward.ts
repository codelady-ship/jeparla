import { userFetch } from "@/lib/auth/backend";
import { readJson, requestLocale } from "@/lib/auth/server";
import { USING_MOCK } from "./mode";
import { problemResponse } from "./problem";
import type { Query } from "./http";

/**
 * A route handler that passes the browser's JSON body to one backend endpoint as the
 * signed-in user (token from the httpOnly cookie, refreshed when needed) and answers with
 * the backend's JSON, or `{ errors }` in the form shape. Roles and ownership are the
 * backend's decision. With the sample data there is no backend: 503 "unavailable".
 */
export async function forwardJson(
  request: Request,
  path: string,
  {
    method = "POST",
    status = 200,
    body,
    query,
    timeoutMs,
  }: {
    method?: "POST" | "PUT" | "PATCH" | "DELETE";
    status?: number;
    body?: unknown;
    query?: Query;
    /** Longer than the default for slow work, e.g. reading a catalog PDF. */
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  if (USING_MOCK) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  const payload =
    body !== undefined ? body : method === "DELETE" ? undefined : await readJson(request);
  try {
    const data = await userFetch(path, {
      method,
      body: payload ?? undefined,
      query,
      timeoutMs,
      canRefresh: true,
      locale: requestLocale(request),
    });
    return data === null ? new Response(null, { status: 204 }) : Response.json(data, { status });
  } catch (e) {
    return problemResponse(e);
  }
}
