import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { SellerIdentity as Identity } from "@/types/api";

/**
 * Who sells (#249, Law on Electronic Commerce art. 5.3): the registered name, legal form and VOEN
 * as the seller gave them in the cabinet. Shown only when the seller wrote the registered name.
 */
export async function SellerIdentity({ seller }: { seller: Identity }) {
  const [t, tl] = await Promise.all([
    getTranslations("Stores.seller"),
    getTranslations("Sell.legal"),
  ]);
  return (
    <section aria-labelledby="store-seller" className="flex flex-col gap-3">
      <h2 id="store-seller" className="flex items-center gap-2 text-xl">
        <Building2 aria-hidden className="size-5 text-gold-text" />
        {t("title")}
      </h2>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="sr-only">{t("title")}</dt>
        <dd className="font-medium break-words sm:col-span-2">{seller.legalName}</dd>
        <dt className="text-muted-foreground">{t("legalForm")}</dt>
        <dd>{tl(seller.legalType)}</dd>
        {seller.taxId && (
          <>
            <dt className="text-muted-foreground">{t("taxId")}</dt>
            <dd className="tabular-nums">{seller.taxId}</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
