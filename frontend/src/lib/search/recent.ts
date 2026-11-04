/** Last searches of this browser (newest first), kept in localStorage. */
const KEY = "jeparla-recent-searches";
const MAX = 5;

export function readRecent(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function addRecent(query: string): string[] {
  const q = query.trim().slice(0, 100);
  if (!q) return readRecent();
  const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
    0,
    MAX,
  );
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: keep it for this page only.
  }
  return next;
}

export function clearRecent(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // ignore
  }
}
