"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "./session";

/**
 * Current session for client UI. Fetched once from /api/auth/me on first use
 * (pages stay static), then updated by signIn/signOut.
 */
type State = { status: "loading" } | { status: "ready"; session: Session | null };

let state: State = { status: "loading" };
let started = false;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function load() {
  if (started) return;
  started = true;
  fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ session: Session | null }>) : { session: null }))
    .then((d) => set({ status: "ready", session: d.session }))
    .catch(() => set({ status: "ready", session: null }));
}

const LOADING: State = { status: "loading" };

export function useSession(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      load();
      return () => listeners.delete(cb);
    },
    () => state,
    () => LOADING,
  );
}

export function setSession(session: Session | null) {
  started = true;
  set({ status: "ready", session });
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  setSession(null);
}

export type AuthResult =
  { ok: true; session: Session } | { ok: false; errors: Record<string, string> };

/** Posts a form to an auth route. The password is only in the request body. */
export async function postAuth(path: string, body: Record<string, string>): Promise<AuthResult> {
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
