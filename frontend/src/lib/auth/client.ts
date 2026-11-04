"use client";

import { useSyncExternalStore } from "react";
import { SIGNED_IN_COOKIE, type Session } from "./session";

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
  // Guests (most visitors, and Lighthouse) skip the request entirely.
  if (!document.cookie.split("; ").includes(`${SIGNED_IN_COOKIE}=1`)) {
    queueMicrotask(() => set({ status: "ready", session: null }));
    return;
  }
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
