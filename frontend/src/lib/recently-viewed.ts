/**
 * Product ids this browser opened, newest first (#174). Kept in localStorage; no
 * account needed and nothing is sent anywhere except to load the cards.
 */
const KEY = "jeparla-recently-viewed";
export const RECENT_MAX = 12;

export function readRecent(): number[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is number => Number.isInteger(x)).slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

/** Moves `id` to the front; returns the ids viewed before it (newest first). */
export function recordView(id: number): number[] {
  const before = readRecent().filter((x) => x !== id);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify([id, ...before].slice(0, RECENT_MAX)));
  } catch {
    // Storage blocked: the list just stays empty.
  }
  return before;
}
