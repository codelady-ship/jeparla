import type { Metadata, Viewport } from "next";
import { Cormorant } from "next/font/google";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { ViewTransition } from "react";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { NoticeRegion } from "@/components/feedback/notice-region";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { CompareTray } from "@/components/saved/compare-tray";
import { SampleDataBanner } from "@/components/layout/sample-data-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { alternates, SITE_URL } from "@/i18n/alternates";
import { PAGE_TRANSITION } from "@/i18n/navigation";
import { USING_MOCK } from "@/lib/api";
import { routing } from "@/i18n/routing";
import colors from "@/lib/brand-colors.json";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/open-graph";
import "../globals.css";

// Headings: Cormorant, a variable editorial serif, so one file per unicode subset
// (Latin Extended covers Azerbaijani, plus Cyrillic). Body text uses the system font:
// the font budget is two files per page (lighthouserc.cjs), and a second web font
// cost mobile performance. Prices fall back to the system font for the manat sign.
const cormorant = Cormorant({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  // No preload: it would fetch every subset (Cyrillic on az pages too). The browser
  // downloads only the subsets a page uses, so each page stays at two font files.
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Browser chrome (Android address bar, installed app title bar) matches the page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.light.bg },
    { media: "(prefers-color-scheme: dark)", color: colors.dark.bg },
  ],
};

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
    // No og:url here: a page without its own Open Graph must not claim to be the home page.
    openGraph: { siteName: "Jeparla", locale, type: "website", images: [DEFAULT_OG_IMAGE] },
    twitter: { card: "summary_large_image" },
    applicationName: "Jeparla",
    // The installable app in this page's language (start URL, shortcuts).
    manifest: `/${locale}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Jeparla", statusBarStyle: "default" },
    // Search Console / Bing Webmaster ownership tokens, set in the host env when ready.
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION && { google: process.env.GOOGLE_SITE_VERIFICATION }),
      ...(process.env.BING_SITE_VERIFICATION && {
        other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION },
      }),
    },
    // The site has its own light and dark themes; Dark Reader would invert them again
    // (and the cream hero video would no longer match the page).
    other: { "darkreader-lock": "true" },
    // Sample data is invented: never index it as real stores, products or prices.
    ...(USING_MOCK && { robots: { index: false, follow: true } }),
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  // Root param, not `params`: unknown segments below (e.g. [...rest]) stay prerenderable.
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const [messages, tc, tp] = await Promise.all([
    getMessages({ locale }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Pwa" }),
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
      className={`${cormorant.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <IntlProvider locale={locale} messages={clientMessages}>
          <ThemeProvider>
            <SampleDataBanner locale={locale} />
            <SiteHeader />
            {/* In-app navigations cross-fade the page body; header and footer stay put.
                Only the PAGE_TRANSITION type: streamed first-load reveals do not animate. */}
            <ViewTransition update={{ [PAGE_TRANSITION]: "auto", default: "none" }}>
              <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
                {children}
              </main>
            </ViewTransition>
            <SiteFooter />
            <CompareTray label={tc("compare")} />
            <NoticeRegion closeLabel={tc("close")} />
            <InstallPrompt
              labels={{
                title: {
                  phone: tp("installTitle"),
                  tablet: tp("installTitleTablet"),
                  desktop: tp("installTitleDesktop"),
                },
                text: {
                  phone: tp("installText"),
                  tablet: tp("installTextTablet"),
                  desktop: tp("installTextDesktop"),
                },
                install: {
                  phone: tp("install"),
                  tablet: tp("install"),
                  desktop: tp("installDesktop"),
                },
                notNow: tp("notNow"),
                iosText: tp("iosText"),
                iosStep1: tp("iosStep1"),
                iosStep2: tp("iosStep2"),
                gotIt: tp("gotIt"),
              }}
            />
            <ServiceWorker />
          </ThemeProvider>
        </IntlProvider>
      </body>
    </html>
  );
}
