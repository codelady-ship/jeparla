"use client";

import { useEffect, useState } from "react";

const PREFIX = "jeparla.seen.";

/**
 * Shows `text`; if this browser last saw a different value under `storageKey`, the old
 * value lifts away and the new one settles in, once (#118). Nothing moves when the value
 * is the same or on a first visit. Reduced motion: the new value only (globals.css).
 */
export function ChangingValue({ storageKey, text }: { storageKey: string; text: string }) {
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(PREFIX + storageKey);
      window.localStorage.setItem(PREFIX + storageKey, text);
    } catch {
      return; // Storage blocked: just show the value.
    }
    if (seen === null || seen === text) return;
    // Runs after paint on purpose: the first render matches the server HTML.
    const frame = window.requestAnimationFrame(() => setPrevious(seen));
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey, text]);

  if (previous === null) return <>{text}</>;
  return (
    <span className="inline-grid">
      <span aria-hidden className="value-out [grid-area:1/1]">
        {previous}
      </span>
      <span className="value-in [grid-area:1/1]">{text}</span>
    </span>
  );
}
