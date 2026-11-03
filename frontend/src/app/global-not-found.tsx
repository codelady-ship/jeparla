import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { routing } from "@/i18n/routing";
import az from "../../messages/az.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import "./globals.css";

// Shown for URLs that match no route. It renders outside app/[locale], so the
// language is unknown: the message appears in all three languages, az first.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const MESSAGES = { az, en, ru } as const;

export const metadata: Metadata = {
  title: `404 | Jeparla`,
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="az" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-8 px-4 py-24 text-center">
            <h1 className="text-6xl font-semibold text-gold-text">404</h1>
            {routing.locales.map((locale) => {
              const t = MESSAGES[locale].Errors;
              return (
                <section key={locale} lang={locale} className="flex flex-col items-center gap-2">
                  <h2 className="text-xl font-semibold">{t.notFoundTitle}</h2>
                  <p className="text-sm text-muted-foreground">{t.notFoundText}</p>
                  <a href={`/${locale}`} className="link-underline text-sm font-medium">
                    {t.backHome}
                  </a>
                </section>
              );
            })}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
