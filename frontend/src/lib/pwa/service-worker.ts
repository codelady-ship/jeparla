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
 *
 * Caches:
 * - `jeparla-static-v1`: hashed /_next/static/ files only, kept across builds. Older
 *   workers also put unhashed files here; activate removes those entries (#147).
 * - `jeparla-assets-<version>`: unhashed public files, stale-while-revalidate. One cache
 *   per build; activate deletes the caches of older builds.
 * - `jeparla-offline-<version>`: the offline pages and their icon, per build.
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
const ASSET_CACHE = "jeparla-assets-" + VERSION;
const OFFLINE_CACHE = "jeparla-offline-" + VERSION;
const MAX_ENTRIES = 300;
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
      const old = (n) =>
        (n.startsWith("jeparla-offline-") && n !== OFFLINE_CACHE) ||
        (n.startsWith("jeparla-assets-") && n !== ASSET_CACHE);
      await Promise.all(names.filter(old).map((n) => caches.delete(n)));
      if (names.includes(STATIC_CACHE)) {
        const cache = await caches.open(STATIC_CACHE);
        const keys = await cache.keys();
        await Promise.all(
          keys
            .filter((k) => new URL(k.url).pathname.indexOf("/_next/static/") !== 0)
            .map((k) => cache.delete(k)),
        );
      }
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
  if (kind === "immutable") event.respondWith(cacheFirst(req));
  else if (kind === "revalidate") staleWhileRevalidate(event);
  else if (kind === "page") event.respondWith(pageOrOffline(event, url));
});

const cacheable = (res) => res.ok && res.type === "basic";

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) {
    cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {});
  }
  return res;
}

/**
 * The cached copy answers at once; the network refreshes the cache for the next load.
 * Offline with nothing in this cache, any cache answers (the offline page's icon).
 */
function staleWhileRevalidate(event) {
  const req = event.request;
  const network = fetch(req).then((res) => ({ res, copy: cacheable(res) ? res.clone() : null }));
  event.waitUntil(
    network
      .then(async ({ copy }) => {
        if (!copy) return;
        const cache = await caches.open(ASSET_CACHE);
        await cache.put(req, copy);
        await trim(cache);
      })
      .catch(() => {}),
  );
  event.respondWith(
    caches
      .open(ASSET_CACHE)
      .then((cache) => cache.match(req))
      .then(
        (hit) =>
          hit ||
          network
            .then(({ res }) => res)
            .catch(async () => (await caches.match(req)) || Response.error()),
      ),
  );
}

async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_ENTRIES;
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
