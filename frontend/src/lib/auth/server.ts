import { cookies } from "next/headers";
import { USING_MOCK } from "@/lib/api";
import {
  decodeSession,
  encodeSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SIGNED_IN_COOKIE,
  type Role,
  type Session,
} from "./session";

export async function readSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function writeSession(s: Session) {
  const jar = await cookies();
  const base = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
  jar.set(SESSION_COOKIE, encodeSession(s), { ...base, httpOnly: true });
  jar.set(SIGNED_IN_COOKIE, "1", base);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_COOKIE);
}

/**
 * Demo sign-in while the backend does not exist (Day 5 replaces this with
 * POST /api/v1/auth/login). Any valid email and password work; the role comes
 * from the address: admin@... is ADMIN, merchant@... and merchant+new@... (a seller
 * still waiting for approval) are MERCHANT, others USER.
 * Passwords are never stored or logged.
 */
export function mockRoleFor(email: string): Role {
  const local = email.split("@")[0]?.toLowerCase();
  if (local === "admin") return "ADMIN";
  return local === "merchant" || local?.startsWith("merchant+") ? "MERCHANT" : "USER";
}

/** Sign-in demo accounts exist only with the sample data; otherwise the backend decides. */
export const DEMO_AUTH = USING_MOCK;

/**
 * The site language of a route handler call, for the backend's error texts: the page that
 * sent it (Referer), else the next-intl cookie, else Azerbaijani.
 */
export function requestLocale(request: Request): string {
  const locales = ["az", "en", "ru"];
  try {
    const first = new URL(request.headers.get("referer") ?? "").pathname.split("/")[1];
    if (locales.includes(first)) return first;
  } catch {
    // no or bad Referer
  }
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)NEXT_LOCALE=(\w+)/)?.[1];
  return cookie && locales.includes(cookie) ? cookie : "az";
}

export function unavailable() {
  return Response.json({ error: "unavailable" }, { status: 503 });
}

/** JSON body or null; bad JSON is a client error, not a crash. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
