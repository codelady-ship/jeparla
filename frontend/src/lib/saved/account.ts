import { SIGNED_IN_COOKIE } from "@/lib/auth/session";

/**
 * Favourites of a signed-in buyer are also kept in the account (#112, backend
 * /api/v1/favorites), so the saved price survives another device or a cleared browser.
 * The browser list stays the source for the UI; these calls mirror it. Guests (no
 * signed-in marker cookie) make no request at all.
 */
export function signedIn(): boolean {
  try {
    return document.cookie.split("; ").includes(`${SIGNED_IN_COOKIE}=1`);
  } catch {
    return false;
  }
}

/** Mirrors one add or remove into the account; failures only leave the account behind. */
export function pushFavorite(id: number, on: boolean): void {
  if (!signedIn()) return;
  void fetch(`/api/favorites/${id}`, { method: on ? "PUT" : "DELETE", keepalive: true }).catch(
    () => undefined,
  );
}
