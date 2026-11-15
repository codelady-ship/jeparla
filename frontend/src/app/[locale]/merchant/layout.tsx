import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MerchantNav } from "@/components/merchant/merchant-nav";
import { Suspense } from "react";
import { USING_MOCK } from "@/lib/api";
import { unreadCount } from "@/lib/api/account";

/** Unread notifications next to the tab; nothing when there are none or the API is down. */
async function UnreadCount() {
  if (USING_MOCK) return null;
  const [count, t] = await Promise.all([
    unreadCount().catch(() => 0),
    getTranslations("Merchant.nav"),
  ]);
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
      <span aria-hidden>{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{t("unread", { count })}</span>
    </span>
  );
}

export default async function MerchantLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Merchant");
  return (
    <div className="container-page flex flex-1 flex-col gap-6 py-6 sm:py-10">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-gold-text uppercase">{t("title")}</p>
        <MerchantNav
          label={t("nav.label")}
          labels={{
            dashboard: t("nav.dashboard"),
            products: t("nav.products"),
            import: t("nav.import"),
            share: t("nav.share"),
            profile: t("nav.profile"),
            documents: t("nav.documents"),
            notifications: t("nav.notifications"),
          }}
          badges={{
            notifications: (
              <Suspense fallback={null}>
                <UnreadCount />
              </Suspense>
            ),
          }}
        />
      </div>
      {USING_MOCK && <p className="text-xs text-muted-foreground">{t("demoNote")}</p>}
      {children}
    </div>
  );
}
