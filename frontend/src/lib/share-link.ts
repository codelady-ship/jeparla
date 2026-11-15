import { defaultLocale, locales, type Locale } from "@/i18n/routing";

/**
 * The short store link `/s/<code>` (#100): not localised, so it fits an Instagram bio or a
 * printed QR code. The proxy resolves the code with GET /api/v1/share/{code} and sends the
 * visitor to the store page in their language with the link's source.
 */
export const SHARE_PATH = /^\/s\/([a-z0-9]{4,32})\/?$/i;

/** Demo share code of the first sample store (NEXT_PUBLIC_USE_MOCK=true only). */
export const DEMO_SHARE_CODE = "demo2345";
export const DEMO_SHARE_SLUG = "ayzer-zerger";

/** The language cookie of next-intl (i18n/routing localeCookie). */
export const LOCALE_COOKIE = "JEPARLA_LOCALE";

/** Language from the site's language cookie, then the browser's Accept-Language, then az. */
export function shareLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  const known = (value: string | undefined): Locale | null => {
    const lang = value?.trim().toLowerCase().split(/[-_;]/)[0];
    return locales.find((l) => l === lang) ?? null;
  };
  const fromCookie = known(cookie);
  if (fromCookie) return fromCookie;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    const hit = known(tag);
    if (hit) return hit;
  }
  return defaultLocale;
}

/**
 * Store page address for a resolved share link. The incoming `ref` or `utm_source` is kept,
 * so `?ref=instagram` in a bio counts for Instagram; a bare link counts as `link`.
 */
export function shareTarget(slug: string, locale: Locale, incoming: URLSearchParams): string {
  const out = new URLSearchParams();
  const ref = incoming.get("ref")?.trim();
  const utm = incoming.get("utm_source")?.trim();
  if (ref) out.set("ref", ref);
  else if (utm) out.set("utm_source", utm);
  else out.set("ref", "link");
  return `/${locale}/stores/${encodeURIComponent(slug)}?${out.toString()}`;
}
