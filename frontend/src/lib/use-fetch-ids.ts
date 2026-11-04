"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type Result<T> = { key: string; data?: T[]; error?: boolean };
export type IdsState<T> =
  { status: "loading" } | { status: "error"; retry: () => void } | { status: "done"; data: T[] };

const noop = () => () => {};

/**
 * Loads `${url}?ids=` for ids kept in localStorage. Loading until hydrated (the
 * server cannot see localStorage), then while the current id set is in flight.
 */
export function useFetchIds<T>(url: string, ids: readonly number[]): IdsState<T> {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const key = ids.join(",");
  const [result, setResult] = useState<Result<T>>({ key: "" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!hydrated || key === "") return;
    const ctrl = new AbortController();
    fetch(`${url}?ids=${key}`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<T[]>;
      })
      .then((data) => setResult({ key, data }))
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key, error: true });
      });
    return () => ctrl.abort();
  }, [url, key, hydrated, attempt]);

  if (!hydrated) return { status: "loading" };
  if (key === "") return { status: "done", data: [] };
  if (result.key !== key) return { status: "loading" };
  if (result.error)
    return {
      status: "error",
      retry: () => {
        setResult({ key: "" });
        retry();
      },
    };
  return { status: "done", data: result.data ?? [] };
}
