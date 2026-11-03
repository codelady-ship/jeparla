import { defineRouting } from "next-intl/routing";

export const locales = ["az", "en", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "az";

// Every language has its own URL (/az, /en, /ru) for SEO, hreflang and AI crawlers.
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeCookie: { name: "JEPARLA_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});
