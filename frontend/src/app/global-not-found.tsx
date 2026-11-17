import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { defaultLocale, routing } from "@/i18n/routing";
import az from "../../messages/az.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import "./globals.css";

// Only for URLs with no language: anything under /az, /en or /ru reaches
// the localized 404 page ([locale]/404, see next.config.ts) with the site header and footer,
// and the proxy sends other paths to the visitor's language first.
// The language is unknown here, so the page is in az, the default, with links to
// the home page in the other languages, each labelled in its own language.
const MESSAGES = { az, en, ru } as const;
const t = MESSAGES[defaultLocale].Errors;
const others = routing.locales.filter((l) => l !== defaultLocale);

export const metadata: Metadata = {
  title: `${t.notFoundTitle} | Jeparla`,
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang={defaultLocale} className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
            <p className="text-6xl font-semibold text-gold-text">404</p>
            <h1 className="text-3xl font-semibold">{t.notFoundTitle}</h1>
            <p className="text-muted-foreground">{t.notFoundText}</p>
            <a href={`/${defaultLocale}`} className="link-underline font-medium">
              {t.backHome}
            </a>
            <ul className="flex gap-6 text-sm">
              {others.map((locale) => (
                <li key={locale}>
                  <a href={`/${locale}`} lang={locale} hrefLang={locale} className="link-underline">
                    {MESSAGES[locale].LocaleSwitcher.locale[locale]}
                  </a>
                </li>
              ))}
            </ul>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
