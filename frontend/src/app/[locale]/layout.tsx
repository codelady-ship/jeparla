import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { ViewTransition } from "react";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { NoticeRegion } from "@/components/feedback/notice-region";
import { CompareTray } from "@/components/saved/compare-tray";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { alternates, SITE_URL } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Headings use Playfair Display (Azerbaijani and Cyrillic covered; no manat sign, so
// prices use the body font). Body text is the system UI font (globals.css), chosen in
// #60: no font download on first load. Playfair is headings only and is not preloaded.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: "%s | Jeparla" },
    description: t("description"),
    alternates: alternates(locale),
    openGraph: { siteName: "Jeparla", locale, type: "website", url: `${SITE_URL}/${locale}` },
    twitter: { card: "summary_large_image" },
    applicationName: "Jeparla",
    // Search Console / Bing Webmaster ownership tokens, set in the host env when ready.
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION && { google: process.env.GOOGLE_SITE_VERIFICATION }),
      ...(process.env.BING_SITE_VERIFICATION && {
        other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION },
      }),
    },
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  // Root param, not `params`: unknown segments below (e.g. [...rest]) stay prerenderable.
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const [messages, tc] = await Promise.all([
    getMessages({ locale }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  // Only namespaces used by Client Components go to the browser (keeps JS small).
  const clientMessages = {
    Common: messages.Common,
    LocaleSwitcher: messages.LocaleSwitcher,
    Errors: messages.Errors,
  };

  return (
    <html
      lang={locale}
      className={`${playfair.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <IntlProvider locale={locale} messages={clientMessages}>
          <ThemeProvider>
            <SiteHeader />
            {/* Route changes cross-fade the page body; header and footer stay put. */}
            <ViewTransition>
              <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
                {children}
              </main>
            </ViewTransition>
            <SiteFooter />
            <CompareTray label={tc("compare")} />
            <NoticeRegion closeLabel={tc("close")} />
          </ThemeProvider>
        </IntlProvider>
      </body>
    </html>
  );
}
