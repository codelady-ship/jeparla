import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MerchantNav } from "@/components/merchant/merchant-nav";
import { USING_MOCK } from "@/lib/api";

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
            profile: t("nav.profile"),
          }}
        />
      </div>
      {USING_MOCK && <p className="text-xs text-muted-foreground">{t("demoNote")}</p>}
      {children}
    </div>
  );
}
