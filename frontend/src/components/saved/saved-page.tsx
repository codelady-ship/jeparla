import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";

type Kind = "favorites" | "compare";

/** Personal lists: nothing to index, links are still followed. */
export async function savedMetadata(kind: Kind): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Saved" });
  return {
    title: t(`${kind}Title`),
    description: t(`${kind}Description`),
    alternates: alternates(locale, `/${kind}`),
    robots: { index: false, follow: true },
  };
}

/** Static shell with the heading; the list itself renders on the client from localStorage. */
export async function SavedPage({ kind, children }: { kind: Kind; children: ReactNode }) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const [t, m] = await Promise.all([
    getTranslations({ locale, namespace: "Saved" }),
    getMessages({ locale }),
  ]);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-2 text-3xl sm:text-4xl">{t(`${kind}Title`)}</h1>
      <p className="mb-8 max-w-2xl text-muted-foreground">{t(`${kind}Intro`)}</p>
      <IntlProvider
        locale={locale}
        messages={{
          Common: m.Common,
          Errors: m.Errors,
          Saved: m.Saved,
          Product: m.Product,
          Pdp: m.Pdp,
        }}
      >
        {children}
      </IntlProvider>
    </div>
  );
}
