/**
 * When to offer "add Jeparla to your home screen" (issue #136).
 *
 * Engagement rule: the offer waits until the visitor has shown interest, which is a
 * second visit (a new browser session) or a second product page. A first-time visitor
 * never sees it. Once dismissed it never comes back on its own; once installed, or when
 * the site already runs as the installed app, it is never shown.
 *
 * Everything is stored in localStorage; every access is guarded, because storage can be
 * missing or throw (private mode, blocked site data). Without storage nothing is offered.
 */

export const KEYS = {
  visits: "jeparla-pwa-visits",
  products: "jeparla-pwa-products",
  dismissed: "jeparla-pwa-dismissed",
  installed: "jeparla-pwa-installed",
  /** sessionStorage: this session is already counted as a visit. */
  session: "jeparla-pwa-session",
} as const;

export const VISITS_TO_OFFER = 2;
export const PRODUCTS_TO_OFFER = 2;
/** Product slugs remembered for the counter; more are not needed. */
const MAX_PRODUCTS = PRODUCTS_TO_OFFER;

export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

function read(store: KeyValueStore | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(store: KeyValueStore | null, key: string, value: string): boolean {
  try {
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** localStorage / sessionStorage, or null when the browser refuses access. */
export function storage(kind: "localStorage" | "sessionStorage"): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null;
  }
}

/** Counts this browser session as one visit (only once per session). Returns the total. */
export function recordVisit(local: KeyValueStore | null, session: KeyValueStore | null): number {
  const visits = Number(read(local, KEYS.visits)) || 0;
  if (read(session, KEYS.session)) return visits;
  if (!write(session, KEYS.session, "1")) return visits;
  write(local, KEYS.visits, String(visits + 1));
  return visits + 1;
}

function viewedProducts(local: KeyValueStore | null): string[] {
  try {
    const list: unknown = JSON.parse(read(local, KEYS.products) ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Remembers a product page; the same product twice counts once. Returns the count. */
export function recordProductView(local: KeyValueStore | null, slug: string): number {
  const seen = viewedProducts(local);
  if (seen.includes(slug) || seen.length >= MAX_PRODUCTS) return seen.length;
  const next = [...seen, slug];
  write(local, KEYS.products, JSON.stringify(next));
  return next.length;
}

export function isEngaged(local: KeyValueStore | null): boolean {
  const visits = Number(read(local, KEYS.visits)) || 0;
  return visits >= VISITS_TO_OFFER || viewedProducts(local).length >= PRODUCTS_TO_OFFER;
}

export function dismiss(local: KeyValueStore | null): void {
  write(local, KEYS.dismissed, new Date().toISOString());
}

export function isDismissed(local: KeyValueStore | null): boolean {
  return read(local, KEYS.dismissed) !== null;
}

export function markInstalled(local: KeyValueStore | null): void {
  write(local, KEYS.installed, new Date().toISOString());
}

export function isInstalled(local: KeyValueStore | null): boolean {
  return read(local, KEYS.installed) !== null;
}

/** True when the page runs as the installed app (Android, desktop or iOS home screen). */
export function isStandalone(
  win: Pick<Window, "matchMedia"> & { navigator: Navigator & { standalone?: boolean } },
): boolean {
  return (
    win.matchMedia("(display-mode: standalone)").matches ||
    win.matchMedia("(display-mode: minimal-ui)").matches ||
    win.navigator.standalone === true
  );
}

/**
 * iPhone or iPad Safari: no install event, but "Share, then Add to Home Screen" works.
 * In-app browsers (Instagram, Facebook) and other iOS browsers are left out, because
 * their menus differ and the steps would be wrong. iPadOS reports itself as a Mac,
 * so a Mac with a touch screen counts as an iPad.
 */
export function isIosSafari(ua: string, maxTouchPoints = 0): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  return (
    ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV/.test(ua)
  );
}

/** Slug of a product page path such as /az/products/qizil-uzuk, otherwise null. */
export function productSlug(pathname: string): string | null {
  const m = pathname.match(/^\/[a-z]{2}\/products\/([^/?#]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export type Offer = "prompt" | "ios" | null;

/**
 * What to offer now. "prompt": the browser can install (Android Chrome, desktop
 * Chromium) and gave us its install event. "ios": Safari, show the two steps.
 * Desktop browsers without the install event get nothing.
 */
export function offerFor(state: {
  engaged: boolean;
  dismissed: boolean;
  installed: boolean;
  standalone: boolean;
  canPrompt: boolean;
  iosSafari: boolean;
}): Offer {
  if (!state.engaged || state.dismissed || state.installed || state.standalone) return null;
  if (state.canPrompt) return "prompt";
  if (state.iosSafari) return "ios";
  return null;
}
