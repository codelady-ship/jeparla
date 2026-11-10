import { swStrategy } from "./sw-policy";

/** Offline fallback page per locale, served by app/[locale]/offline.html. */
export const offlinePath = (locale: string) => `/${locale}/offline.html`;

/** The app icon the offline page shows; cached with it. */
export const OFFLINE_ICON = "/icons/icon-192.png";

/**
 * Source of /sw.js. Hand-written and small (no Workbox: it would cost script budget
 * and hide the rules). The request rules live in sw-policy.ts, which is unit tested
 * and inlined here.
 *
 * Updates: every build gets a new `version`, so the browser sees a changed script and
 * installs it. The new worker activates at once (skipWaiting + clients.claim); that is
 * safe because pages are never cached, and hashed static files stay in their cache
 * across versions, so a tab opened before the deploy can still load its own chunks.
 */
export function serviceWorkerSource({
  version,
  locales,
}: {
  version: string;
  locales: readonly string[];
}): string {
  return `/* Jeparla service worker ${version}. Rules: src/lib/pwa/sw-policy.ts */
"use strict";
const VERSION = ${JSON.stringify(version)};
const LOCALES = ${JSON.stringify(locales)};
const STATIC_CACHE = "jeparla-static-v1";
const OFFLINE_CACHE = "jeparla-offline-" + VERSION;
const MAX_STATIC_ENTRIES = 300;
const strategy = ${swStrategy.toString()};
const offlinePath = (locale) => "/" + locale + "/offline.html";
const OFFLINE_ICON = ${JSON.stringify(OFFLINE_ICON)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll([...LOCALES.map(offlinePath), OFFLINE_ICON, "/icon.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("jeparla-offline-") && n !== OFFLINE_CACHE)
          .map((n) => caches.delete(n)),
      );
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const rsc = req.headers.has("RSC") || req.headers.has("Next-Router-State-Tree");
  const kind = strategy(url, { method: req.method, mode: req.mode, rsc }, self.location.origin);
  if (kind === "static") event.respondWith(cacheFirst(req));
  else if (kind === "page") event.respondWith(pageOrOffline(event, url));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") {
    cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {});
  }
  return res;
}

async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_STATIC_ENTRIES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

async function pageOrOffline(event, url) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const first = url.pathname.split("/")[1];
    const locale = LOCALES.includes(first) ? first : LOCALES[0];
    const cache = await caches.open(OFFLINE_CACHE);
    return (await cache.match(offlinePath(locale))) || Response.error();
  }
}
`;
}
