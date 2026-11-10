"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production builds, once the page has fully loaded, so it never
 * competes with the first paint. The worker updates itself: the browser checks /sw.js
 * on navigations, and a new build activates at once (see lib/pwa/service-worker.ts).
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // No worker (private mode, blocked storage): the site works as before.
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
