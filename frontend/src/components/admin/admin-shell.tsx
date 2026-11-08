import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { routing } from "@/i18n/routing";

export type AdminPage = "overview" | "stores" | "products" | "checks";

/** Private area: titled per page, never indexed. */
export async function adminMetadata(page: AdminPage): Promise<Metadata> {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Admin" });
  return {
    title: `${t(`${page}.title`)} · ${t("title")}`,
    robots: { index: false, follow: false },
  };
}

/** Client islands of the panel read these namespaces with useTranslations. */
export async function AdminIntl({ children }: { children: ReactNode }) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const m = await getMessages({ locale });
  return (
    <IntlProvider
      locale={locale}
      messages={{ Admin: m.Admin, Merchant: { status: m.Merchant.status } }}
    >
      {children}
    </IntlProvider>
  );
}
