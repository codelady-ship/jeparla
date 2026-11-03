import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { formats } from "./formats";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
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
