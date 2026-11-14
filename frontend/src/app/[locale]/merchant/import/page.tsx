import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CsvImport } from "@/components/merchant/csv-import";
import { DraftDeleteButton } from "@/components/merchant/draft-delete-button";
import { DraftUpload } from "@/components/merchant/draft-upload";
import { MerchantIntl, merchantMetadata } from "@/components/merchant/merchant-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { USING_MOCK } from "@/lib/api";
import { merchantDrafts } from "@/lib/api/drafts";
import { merchantContext } from "@/lib/merchant/server";
import { formatGrams, formatPrice } from "@/lib/money";

export const generateMetadata = () => merchantMetadata("import");

const day = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/** Drafts waiting for the product form; the photos are private links valid for minutes. */
async function Drafts() {
  await merchantContext();
  const [t, locale, drafts] = await Promise.all([
    getTranslations("Merchant.import"),
    getLocale(),
    merchantDrafts(),
  ]);
  if (drafts.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        {t("draftsEmpty")}
      </p>
    );
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {drafts.map((d) => {
        const label = d.suggestedName ?? t("draftLabel", { id: d.id });
        return (
          <li key={d.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
            {/* Private, short-lived link: not for the image optimizer or any cache. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.imageUrl}
              alt={t("draftPhotoAlt", { name: label })}
              width={d.width}
              height={d.height}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-square w-full bg-muted object-contain"
            />
            <div className="flex flex-1 flex-col gap-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(`source.${d.source}`)}</Badge>
                {d.pdfPage !== null && (
                  <span className="text-muted-foreground">{t("pdfPage", { page: d.pdfPage })}</span>
                )}
                <span className="text-muted-foreground">{day(d.createdAt)}</span>
              </div>
              {(d.suggestedName || d.suggestedPrice || d.suggestedWeight) && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="col-span-2 text-xs text-muted-foreground">
                    {t("suggestionsTitle")}
                  </dt>
                  {d.suggestedName && (
                    <>
                      <dt className="text-muted-foreground">{t("name")}</dt>
                      <dd className="min-w-0 truncate">{d.suggestedName}</dd>
                    </>
                  )}
                  {d.suggestedPrice && (
                    <>
                      <dt className="text-muted-foreground">{t("price")}</dt>
                      <dd className="tabular-nums">{formatPrice(d.suggestedPrice, locale)}</dd>
                    </>
                  )}
                  {d.suggestedWeight && (
                    <>
                      <dt className="text-muted-foreground">{t("weight")}</dt>
                      <dd className="tabular-nums">{formatGrams(d.suggestedWeight, locale)}</dd>
                    </>
                  )}
                </dl>
              )}
              <div className="mt-auto flex flex-wrap items-start gap-2 pt-2">
                <Link
                  href="/merchant/products/new"
                  className="inline-flex h-10 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t("makeProduct")}
                </Link>
                <DraftDeleteButton id={d.id} label={label} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function MerchantImportPage() {
  const [t, tm] = await Promise.all([
    getTranslations("Merchant.import"),
    getTranslations("Merchant"),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
      </div>
      {USING_MOCK ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {tm("sampleOnly")}
        </p>
      ) : (
        <MerchantIntl>
          <div className="grid gap-6 lg:grid-cols-2">
            <section
              aria-labelledby="import-csv"
              className="flex flex-col gap-4 rounded-lg border bg-card p-5"
            >
              <h2 id="import-csv" className="text-2xl">
                {t("csvTitle")}
              </h2>
              <CsvImport />
            </section>
            <section
              aria-labelledby="import-drafts"
              className="flex flex-col gap-4 rounded-lg border bg-card p-5"
            >
              <h2 id="import-drafts" className="text-2xl">
                {t("draftsTitle")}
              </h2>
              <DraftUpload />
            </section>
          </div>
          <section aria-labelledby="drafts-list" className="flex flex-col gap-4">
            <h2 id="drafts-list" className="text-2xl">
              {t("draftsListTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("draftsListIntro")}</p>
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
              <Drafts />
            </Suspense>
          </section>
        </MerchantIntl>
      )}
    </div>
  );
}
