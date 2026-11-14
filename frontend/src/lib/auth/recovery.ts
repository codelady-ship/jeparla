/**
 * Password reset and email verification (#131), called from the browser.
 *
 * Every call goes to this site's route handlers (lib/auth/recovery-server.ts), like the
 * sign-in: they name the visitor to the backend's per-IP limits, end the local session after a
 * new password and update the confirmed flag of the session. The token arrives in the link
 * fragment (`#token=...`, backend AccountLinks), so it never reaches a server log or a Referer
 * header; it is sent only in a POST body.
 *
 * With the sample data there is no backend: every call succeeds and the pages say that
 * nothing was sent or changed.
 */

export const RECOVERY_PATHS = {
  forgot: "/api/auth/password/forgot",
  reset: "/api/auth/password/reset",
  verify: "/api/auth/email/verify",
  resend: "/api/auth/email/verification",
} as const;

/** Backend ProblemDetail codes the pages react to. */
export const RESET_TOKEN_INVALID = "auth.reset_token_invalid";
export const VERIFICATION_TOKEN_INVALID = "auth.verification_token_invalid";
export const EMAIL_ALREADY_VERIFIED = "auth.email_already_verified";
export const NO_EMAIL = "auth.no_email";

/** Tokens are 256-bit base64url (43 characters); the backend accepts up to 128. */
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

/** The token of a `#token=...` fragment, or null when there is none or it is malformed. */
export function tokenFromHash(hash: string): string | null {
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return raw && TOKEN.test(raw) ? raw : null;
}

/**
 * Reads the token once and removes the fragment from the address bar and the history entry,
 * so it is not left in the tab, a bookmark or a shared screenshot.
 */
export function takeHashToken(): string | null {
  const token = tokenFromHash(window.location.hash);
  if (window.location.hash) {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  }
  return token;
}

/** Result of one call: the HTTP status, the ProblemDetail code and Retry-After in seconds. */
export type CallResult = { status: number; code: string | null; retryAfter: number | null };

/** Status 0: the backend did not answer (offline, down, timeout). */
const NETWORK: CallResult = { status: 0, code: null, retryAfter: null };

export async function readResult(res: Response): Promise<CallResult> {
  const seconds = Number(res.headers.get("Retry-After"));
  let code: string | null = null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: unknown };
    code = typeof body.code === "string" ? body.code : null;
  }
  return {
    status: res.status,
    code,
    retryAfter: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
  };
}

async function post(path: string, body?: unknown): Promise<CallResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(20_000),
    });
    return await readResult(res);
  } catch {
    return NETWORK;
  }
}

export type ForgotOutcome = "sent" | "rateLimited" | "invalid" | "network" | "server";
export type ResetOutcome =
  "done" | "invalidToken" | "rateLimited" | "invalid" | "network" | "server";
export type VerifyOutcome = "done" | "invalidToken" | "rateLimited" | "network" | "server";
export type ResendOutcome =
  | "sent"
  | "alreadyVerified"
  | "noEmail"
  | "rateLimited"
  | "signIn"
  | "unavailable"
  | "network"
  | "server";

function common(r: CallResult): "rateLimited" | "network" | "server" {
  if (r.status === 429) return "rateLimited";
  return r.status === 0 ? "network" : "server";
}

/** 202 for every well-formed address, known or not: the page always says the same. */
export function forgotOutcome(r: CallResult): ForgotOutcome {
  if (r.status === 202) return "sent";
  if (r.status === 400) return "invalid";
  return common(r);
}

export function resetOutcome(r: CallResult): ResetOutcome {
  if (r.status === 204) return "done";
  if (r.status === 400) return r.code === RESET_TOKEN_INVALID ? "invalidToken" : "invalid";
  return common(r);
}

export function verifyOutcome(r: CallResult): VerifyOutcome {
  if (r.status === 204) return "done";
  // Any other 400 (blank or oversized token) is a broken link as well.
  if (r.status === 400) return "invalidToken";
  return common(r);
}

export function resendOutcome(r: CallResult): ResendOutcome {
  if (r.status === 202) return "sent";
  if (r.status === 409) return r.code === NO_EMAIL ? "noEmail" : "alreadyVerified";
  if (r.status === 401 || r.status === 403) return "signIn";
  if (r.status === 503) return "unavailable";
  return common(r);
}

export async function requestPasswordReset(email: string) {
  const r = await post(RECOVERY_PATHS.forgot, { email });
  return { outcome: forgotOutcome(r), retryAfter: r.retryAfter };
}

export async function resetPassword(token: string, password: string) {
  const r = await post(RECOVERY_PATHS.reset, { token, password });
  return { outcome: resetOutcome(r), retryAfter: r.retryAfter };
}

export async function verifyEmail(token: string) {
  const r = await post(RECOVERY_PATHS.verify, { token });
  return { outcome: verifyOutcome(r), retryAfter: r.retryAfter };
}

/**
 * Sends the verification link again. It needs the signed-in account, so it goes through the
 * site's own route handler, which holds the session (the browser never sees a token).
 */
export async function resendVerification() {
  const r = await post(RECOVERY_PATHS.resend);
  return { outcome: resendOutcome(r), retryAfter: r.retryAfter };
}

/**
 * "Try again after 14:05": a clock time needs no plural forms in az, en or ru.
 * `template` holds `{time}`.
 */
export function retryText(
  template: string,
  retryAfter: number | null,
  locale: string,
  now = Date.now(),
): string {
  const at = new Date(now + (retryAfter ?? 60 * 60) * 1000);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(at);
  return template.replace("{time}", time);
}
