/**
 * Session as the frontend sees it. The backend (Day 5) issues a signed JWT and
 * checks roles and ownership on every request; this cookie only drives UX
 * (header menu, redirects). Never treat it as proof of a role.
 */
export type Role = "USER" | "MERCHANT" | "ADMIN";
export type Session = { name: string; email: string; role: Role };

export const SESSION_COOKIE = "jeparla_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
/**
 * Readable marker next to the httpOnly session: it holds no data, it only tells
 * the browser whether asking /api/auth/me is worth it. Guests make no request.
 */
export const SIGNED_IN_COOKIE = "jeparla_signed_in";

const ROLES: readonly Role[] = ["USER", "MERCHANT", "ADMIN"];

export function encodeSession(s: Session): string {
  return Buffer.from(JSON.stringify(s), "utf8").toString("base64url");
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  try {
    // atob + TextDecoder work in every runtime (proxy, route handlers, tests).
    const bytes = Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    );
    const v = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Session>;
    if (typeof v.name !== "string" || !v.name || typeof v.email !== "string") return null;
    if (!ROLES.includes(v.role as Role)) return null;
    return { name: v.name, email: v.email, role: v.role as Role };
  } catch {
    return null;
  }
}

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : role === "MERCHANT" ? "/merchant" : "/";
}

/** Areas that need a role; checked by the proxy for UX, enforced by the backend. */
export const PROTECTED: readonly { prefix: string; roles: readonly Role[] }[] = [
  { prefix: "/merchant", roles: ["MERCHANT", "ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
];

/** Only same-site paths are allowed as ?next= targets (no open redirect). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next.slice(0, 300);
}
