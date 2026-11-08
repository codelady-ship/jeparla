import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { USING_MOCK } from "@/lib/api";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Admin");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-gold-text uppercase">{t("title")}</p>
        <AdminNav
          label={t("nav.label")}
          labels={{
            overview: t("overview.title"),
            stores: t("stores.title"),
            products: t("products.title"),
            checks: t("checks.title"),
          }}
        />
      </div>
      {USING_MOCK && <p className="text-xs text-muted-foreground">{t("demoNote")}</p>}
      {children}
    </div>
  );
}
