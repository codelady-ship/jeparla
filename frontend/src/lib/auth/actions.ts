"use client";

import type { Session } from "./session";
import { setSession } from "./client";

// Kept apart from the session hook so pages only ship this with the forms and
// the signed-in menu, not in every header.

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  setSession(null);
}

export type AuthResult =
  { ok: true; session: Session } | { ok: false; errors: Record<string, string> };

/** Posts a form to an auth route. The password is only in the request body. */
export async function postAuth(path: string, body: unknown): Promise<AuthResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    session?: Session;
    errors?: Record<string, string>;
  };
  if (res.ok && data.session) {
    setSession(data.session);
    return { ok: true, session: data.session };
  }
  return {
    ok: false,
    errors: data.errors ?? { form: res.status === 503 ? "unavailable" : "server" },
  };
}
