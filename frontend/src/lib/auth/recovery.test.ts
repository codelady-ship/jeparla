import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forgotOutcome,
  readResult,
  requestPasswordReset,
  resendOutcome,
  resendVerification,
  resetOutcome,
  resetPassword,
  retryText,
  takeHashToken,
  tokenFromHash,
  verifyEmail,
  verifyOutcome,
} from "./recovery";
import { fieldErrors, resetSchema } from "./schemas";
import { decodeSession, encodeSession } from "./session";

const TOKEN = "Zm9vYmFyYmF6cXV4LXF1dXhfY29yZ2VncmF1bHRnYXJwbHk"; // 47 base64url characters

const r = (status: number, code: string | null = null, retryAfter: number | null = null) => ({
  status,
  code,
  retryAfter,
});

describe("link token", () => {
  it("reads #token= and rejects anything that is not a base64url token", () => {
    expect(tokenFromHash(`#token=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromHash(`token=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromHash("")).toBeNull();
    expect(tokenFromHash("#token=")).toBeNull();
    expect(tokenFromHash("#token=short")).toBeNull();
    expect(tokenFromHash(`#token=${TOKEN}%3Cscript%3E`)).toBeNull();
    expect(tokenFromHash(`#token=${"a".repeat(129)}`)).toBeNull();
  });

  it("removes the fragment from the address bar after reading it", () => {
    window.history.replaceState(null, "", `/az/reset-password?x=1#token=${TOKEN}`);
    expect(takeHashToken()).toBe(TOKEN);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname + window.location.search).toBe("/az/reset-password?x=1");
    expect(takeHashToken()).toBeNull();
  });
});

describe("backend answers", () => {
  it("forgot: 202 is always the same neutral answer", () => {
    expect(forgotOutcome(r(202))).toBe("sent");
    expect(forgotOutcome(r(429, "rate_limited", 120))).toBe("rateLimited");
    expect(forgotOutcome(r(400))).toBe("invalid");
    expect(forgotOutcome(r(0))).toBe("network");
    expect(forgotOutcome(r(500))).toBe("server");
  });

  it("reset: an invalid token is told apart from a rejected password", () => {
    expect(resetOutcome(r(204))).toBe("done");
    expect(resetOutcome(r(400, "auth.reset_token_invalid"))).toBe("invalidToken");
    expect(resetOutcome(r(400, "validation_failed"))).toBe("invalid");
    expect(resetOutcome(r(429))).toBe("rateLimited");
  });

  it("verify: every 400 is a broken link", () => {
    expect(verifyOutcome(r(204))).toBe("done");
    expect(verifyOutcome(r(400, "auth.verification_token_invalid"))).toBe("invalidToken");
    expect(verifyOutcome(r(400, "validation_failed"))).toBe("invalidToken");
    expect(verifyOutcome(r(503))).toBe("server");
  });

  it("resend: 202, both 409s, 401, 429 and the unwired real mode", () => {
    expect(resendOutcome(r(202))).toBe("sent");
    expect(resendOutcome(r(409, "auth.email_already_verified"))).toBe("alreadyVerified");
    expect(resendOutcome(r(409, "auth.no_email"))).toBe("noEmail");
    expect(resendOutcome(r(401))).toBe("signIn");
    expect(resendOutcome(r(429))).toBe("rateLimited");
    expect(resendOutcome(r(503))).toBe("unavailable");
  });

  it("reads the ProblemDetail code and Retry-After", async () => {
    const res = new Response(JSON.stringify({ code: "rate_limited" }), {
      status: 429,
      headers: { "Retry-After": "90" },
    });
    expect(await readResult(res)).toEqual({ status: 429, code: "rate_limited", retryAfter: 90 });
    expect(await readResult(new Response(null, { status: 202 }))).toEqual(r(202));
    expect(await readResult(new Response("not json", { status: 500 }))).toEqual(r(500));
  });

  it("says when to try again as a clock time", () => {
    const now = new Date(2026, 10, 11, 13, 0, 0).getTime();
    expect(retryText("after {time}.", 300, "en-GB", now)).toBe("after 13:05.");
    // Without Retry-After the backend windows are an hour long.
    expect(retryText("{time}", null, "ru", now)).toBe("14:00");
  });
});

describe("calls from the browser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the reset to the site's own route without a referrer", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: "auth.reset_token_invalid" }), { status: 400 }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await resetPassword(TOKEN, "yeni şifrə 1")).toEqual({
      outcome: "invalidToken",
      retryAfter: null,
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/password/reset");
    expect(init).toMatchObject({ method: "POST", referrerPolicy: "no-referrer" });
    expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN, password: "yeni şifrə 1" });
  });

  it("sends the link again without a body", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    expect((await resendVerification()).outcome).toBe("sent");
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/email/verification");
    expect(init.body).toBeUndefined();
  });

  it("treats an unreachable site as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect((await requestPasswordReset("a@b.az")).outcome).toBe("network");
    expect((await verifyEmail(TOKEN)).outcome).toBe("network");
  });
});

describe("new password rules (backend ResetPasswordRequest)", () => {
  it("needs a letter of any script, a digit and a matching confirmation", () => {
    expect(resetSchema.safeParse({ password: "Şəhla2026", confirm: "Şəhla2026" }).success).toBe(
      true,
    );
    expect(resetSchema.safeParse({ password: "пароль77", confirm: "пароль77" }).success).toBe(true);
    const bad = resetSchema.safeParse({ password: "12345678", confirm: "1234567" });
    expect(bad.success).toBe(false);
    if (!bad.success)
      expect(fieldErrors(bad.error)).toEqual({
        password: "passwordLetter",
        confirm: "passwordMismatch",
      });
  });

  it("counts the 72-byte BCrypt limit in UTF-8 bytes", () => {
    const fits = `${"ə".repeat(35)}12`; // 72 bytes
    const tooLong = `${"ə".repeat(36)}12`; // 74 bytes, 38 characters
    expect(resetSchema.safeParse({ password: fits, confirm: fits }).success).toBe(true);
    const r2 = resetSchema.safeParse({ password: tooLong, confirm: tooLong });
    expect(r2.success).toBe(false);
    if (!r2.success) expect(fieldErrors(r2.error).password).toBe("passwordLong");
  });
});

describe("session emailVerified", () => {
  it("keeps the flag when present and leaves it out otherwise", () => {
    const s = { name: "Aysel", email: "a@b.az", role: "USER" as const, emailVerified: false };
    expect(decodeSession(encodeSession(s))).toEqual(s);
    const { emailVerified: _, ...old } = s;
    expect(decodeSession(encodeSession(old))).toEqual(old);
  });
});
