import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { routing } from "@/i18n/routing";
import type { SellerStatus } from "@/types/merchant";

type PageKey = "dashboard" | "products" | "newProduct" | "editProduct" | "profile" | "aiStudio";

/** Cabinet pages are private: noindex, and robots.txt already disallows /merchant. */
export async function merchantMetadata(page: PageKey): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Merchant" });
  const title =
    page === "newProduct"
      ? t("form.newTitle")
      : page === "aiStudio"
        ? t("ai.title")
        : page === "editProduct"
          ? t("form.editTitle")
          : page === "profile"
            ? t("profile.title")
            : page === "products"
              ? t("products.title")
              : t("dashboard.title");
  return { title: `${title} · ${t("title")}`, robots: { index: false, follow: false } };
}

/** Client islands of the cabinet read these namespaces with useTranslations. */
export async function MerchantIntl({ children }: { children: ReactNode }) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const m = await getMessages({ locale });
  return (
    <IntlProvider
      locale={locale}
      messages={{
        Merchant: m.Merchant,
        Product: m.Product,
        Pdp: m.Pdp,
        Sell: m.Sell,
        Auth: m.Auth,
      }}
    >
      {children}
    </IntlProvider>
  );
}

/** Shown until the seller check passes (PLAN 5.9); products stay drafts meanwhile. */
export async function SellerBanner({ status }: { status: SellerStatus }) {
  if (status === "VERIFIED") return null;
  const t = await getTranslations("Merchant.seller");
  return (
    <div role="status" className="flex gap-3 rounded-lg border border-gold/50 bg-muted p-4 text-sm">
      <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-text" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{t(`${status}.title`)}</p>
        <p className="text-muted-foreground">{t(`${status}.text`)}</p>
      </div>
    </div>
  );
}

export { StatusBadge } from "./status-badge";
