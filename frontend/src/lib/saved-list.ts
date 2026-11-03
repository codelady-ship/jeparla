/**
 * Small per-browser list of product ids (favorites, compare) kept in localStorage.
 * Guests use it directly; signed-in users sync it to the server later (#24).
 * Storage can be missing or throw (private mode), so every access is guarded.
 */
export type SavedList = {
  subscribe: (cb: () => void) => () => void;
  /** Stable snapshot for useSyncExternalStore. */
  get: () => readonly number[];
  has: (id: number) => boolean;
  toggle: (id: number) => boolean;
};

const EMPTY: readonly number[] = Object.freeze([]);

export function createSavedList(key: string, max = Infinity): SavedList {
  const listeners = new Set<() => void>();
  let cache: readonly number[] | null = null;

  const read = (): readonly number[] => {
    if (cache) return cache;
    try {
      const raw = globalThis.localStorage?.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      cache = Array.isArray(parsed)
        ? Object.freeze(parsed.filter((x): x is number => Number.isInteger(x)))
        : EMPTY;
    } catch {
      cache = EMPTY;
    }
    return cache;
  };

  const write = (next: readonly number[]) => {
    cache = Object.freeze([...next]);
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(next));
    } catch {
      // Keep the in-memory value for this page view.
    }
    listeners.forEach((l) => l());
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== key) return;
    cache = null;
    listeners.forEach((l) => l());
  };

  return {
    subscribe(cb) {
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
      }
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
        if (listeners.size === 0 && typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
        }
      };
    },
    get: read,
    has: (id) => read().includes(id),
    toggle(id) {
      const current = read();
      const on = !current.includes(id);
      if (on && current.length >= max) return false;
      write(on ? [...current, id] : current.filter((x) => x !== id));
      return on;
    },
  };
}

export const favorites = createSavedList("jeparla-favorites");
/** Comparing more than 4 items is unreadable on a phone. */
export const compare = createSavedList("jeparla-compare", 4);
