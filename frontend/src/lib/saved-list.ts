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
  /** Returns the new state; "full" when adding would pass the limit. */
  toggle: (id: number) => boolean | "full";
  remove: (id: number) => void;
  clear: () => void;
  /** Replaces the whole list, oldest first (the account list after a sync, #112). */
  replace: (ids: readonly number[]) => void;
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
      if (on && current.length >= max) return "full";
      write(on ? [...current, id] : current.filter((x) => x !== id));
      return on;
    },
    remove(id) {
      write(read().filter((x) => x !== id));
    },
    clear() {
      write([]);
    },
    replace(ids) {
      const next = [...new Set(ids.filter((x) => Number.isInteger(x)))];
      const current = read();
      if (next.length === current.length && next.every((x, i) => x === current[i])) return;
      write(Number.isFinite(max) ? next.slice(-max) : next);
    },
  };
}

export const favorites = createSavedList("jeparla-favorites");
/** Comparing more than 4 items is unreadable on a phone. */
export const MAX_COMPARE = 4;
/** Variant ids, not product ids: weight, fineness and price belong to the variant. */
export const compare = createSavedList("jeparla-compare-variants", MAX_COMPARE);
