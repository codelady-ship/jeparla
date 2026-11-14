import { API_BASE, ApiError } from "@/lib/api/http";
import { visitorHeaders } from "@/lib/api/live";
import { USING_MOCK } from "@/lib/api/mode";
import { endSession, sessionOf, userFetch, type AuthResponse } from "./backend";
import { readJson, readSession, requestLocale, writeSession } from "./server";

/**
 * Route handlers of password reset and e-mail verification (#131), backend-for-frontend like
 * the sign-in: the browser posts to this site, the site calls the API with the visitor named
 * for its per-IP limits (lib/api/live visitorHeaders). The answer keeps the backend status,
 * its ProblemDetail `code` and Retry-After, which lib/auth/recovery.ts turns into texts.
 * The token is only in the request body; nothing here logs it.
 */

const PUBLIC = {
  forgot: "/password/forgot",
  reset: "/password/reset",
  verify: "/email/verify",
} as const;

/** Mock answers: with the sample data there is no backend, nothing is sent or changed. */
const MOCK_STATUS = { forgot: 202, reset: 204, verify: 204 } as const;

export function relayAnswer(status: number, code: string | null, retryAfter: string | null) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (retryAfter) headers["Retry-After"] = retryAfter;
  if (status < 400) return new Response(null, { status, headers });
  return Response.json({ code }, { status, headers });
}

/** Re-reads the signed-in account so the session cookie has the confirmed flag. */
async function refreshVerifiedFlag() {
  const session = await readSession();
  if (!session || session.emailVerified !== false) return;
  try {
    const user = await userFetch<AuthResponse["user"]>("/auth/me", { canRefresh: true });
    await writeSession(sessionOf(user));
  } catch {
    // The flag only drives the reminder; the next sign-in brings it anyway.
  }
}

export async function relayPublic(request: Request, kind: keyof typeof PUBLIC): Promise<Response> {
  const body = await readJson(request);
  if (!body || typeof body !== "object") return relayAnswer(400, null, null);
  if (USING_MOCK) return relayAnswer(MOCK_STATUS[kind], null, null);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/auth${PUBLIC[kind]}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Language": requestLocale(request),
        ...(await visitorHeaders()),
      },
      body: JSON.stringify(body),
      // The forgot answer waits for a fixed floor on the backend.
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return relayAnswer(503, null, null);
  }
  let code: string | null = null;
  if (!res.ok) {
    const p = (await res.json().catch(() => ({}))) as { code?: unknown };
    code = typeof p.code === "string" ? p.code : null;
  }
  // A new password ended every session of the account on the backend: end this one too.
  if (kind === "reset" && res.status === 204) await endSession();
  if (kind === "verify" && res.status === 204) await refreshVerifiedFlag();
  return relayAnswer(res.status, code, res.headers.get("Retry-After"));
}

/** Sends the verification link again for the signed-in account (backend: 3 per hour). */
export async function relayResend(request: Request): Promise<Response> {
  const session = await readSession();
  if (!session) return relayAnswer(401, "auth.unauthenticated", null);
  if (USING_MOCK) return relayAnswer(202, null, null);
  try {
    await userFetch("/auth/email/verification", {
      method: "POST",
      canRefresh: true,
      locale: requestLocale(request),
    });
    return relayAnswer(202, null, null);
  } catch (e) {
    if (!(e instanceof ApiError)) return relayAnswer(500, null, null);
    if (e.code === "auth.email_already_verified" && session.emailVerified === false)
      await writeSession({ ...session, emailVerified: true });
    return relayAnswer(e.status === 0 ? 503 : e.status, e.code, null);
  }
}
