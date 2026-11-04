import { cookies } from "next/headers";
import { USING_MOCK } from "@/lib/api";
import {
  decodeSession,
  encodeSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type Role,
  type Session,
} from "./session";

export async function readSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function writeSession(s: Session) {
  (await cookies()).set(SESSION_COOKIE, encodeSession(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Demo sign-in while the backend does not exist (Day 5 replaces this with
 * POST /api/v1/auth/login). Any valid email and password work; the role comes
 * from the address: admin@... is ADMIN, merchant@... is MERCHANT, others USER.
 * Passwords are never stored or logged.
 */
export function mockRoleFor(email: string): Role {
  const local = email.split("@")[0]?.toLowerCase();
  return local === "admin" ? "ADMIN" : local === "merchant" ? "MERCHANT" : "USER";
}

export const AUTH_AVAILABLE = USING_MOCK;

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
