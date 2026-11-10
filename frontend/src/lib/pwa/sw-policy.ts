/**
 * How the service worker treats a request (issues #136, #147):
 * - "immutable": content-hashed build files under /_next/static/ (chunks, CSS, fonts).
 *   Cache first; a new build gives them new URLs, so a cached copy is never stale.
 * - "revalidate": unhashed public files (icons, demo images, placeholders). A file can
 *   be replaced under the same URL (a new logo, a new product photo), so they are
 *   stale-while-revalidate: the cached copy answers at once, the network refreshes the
 *   cache, and the next load shows the new file.
 * - "page": a page navigation. Network only; when the network fails, the offline page.
 *   Pages carry prices, and a price must never be shown from an old copy.
 * - "pass": everything else (API, RSC payloads, video, other origins, non-GET). The
 *   worker does not touch it, so prices and data always come fresh from the server.
 *
 * This function is inlined into /sw.js with Function.prototype.toString(), so it must
 * stay self-contained: no imports, no closures, plain syntax only.
 */
export type SwStrategy = "immutable" | "revalidate" | "page" | "pass";

export function swStrategy(
  url: { origin: string; pathname: string; search: string },
  request: { method: string; mode: string; rsc: boolean },
  selfOrigin: string,
): SwStrategy {
  if (request.method !== "GET" || url.origin !== selfOrigin) return "pass";
  const path = url.pathname;
  if (path.indexOf("/api/") === 0 || request.rsc || url.search.indexOf("_rsc=") !== -1) {
    return "pass";
  }
  if (request.mode === "navigate") return "page";
  if (path.indexOf("/_next/static/") === 0) return "immutable";
  if (
    path.indexOf("/icons/") === 0 ||
    path.indexOf("/demo/") === 0 ||
    path.indexOf("/placeholders/") === 0 ||
    path === "/icon.svg" ||
    path === "/apple-icon.png"
  ) {
    return "revalidate";
  }
  return "pass";
}
