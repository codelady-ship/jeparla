import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { formats } from "./formats";
import { routing } from "./routing";

// The locale is the root param of app/[locale]. Reading it through next/root-params
// keeps every page prerenderable with Cache Components (no headers() access), which
// replaces the deprecated setRequestLocale() calls.
export default getRequestConfig(async ({ locale: explicit }) => {
  const requested = explicit ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    timeZone: "Asia/Baku",
    formats,
    messages: (await import(`../../messages/${locale}.json`)).default,
    onError(error) {
      // Missing keys are a build warning, not a crash; the key-parity test fails CI.
      console.warn(`[i18n] ${error.message}`);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});
