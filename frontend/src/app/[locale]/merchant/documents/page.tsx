import { FileText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DocumentUpload } from "@/components/merchant/document-upload";
import { MerchantIntl, merchantMetadata } from "@/components/merchant/merchant-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { USING_MOCK } from "@/lib/api";
import { declaration, merchantDocuments, type DocumentStatus } from "@/lib/api/account";
import { merchantContext } from "@/lib/merchant/server";

export const generateMetadata = () => merchantMetadata("documents");

const BADGE: Record<DocumentStatus, "default" | "gold" | "destructive" | "outline"> = {
  VERIFIED: "default",
  PENDING: "gold",
  REJECTED: "destructive",
  CHANGES_REQUESTED: "outline",
};

const day = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

async function Documents() {
  const { api } = await merchantContext();
  const locale = await getLocale();
  const [t, store, docs, text, rows] = await Promise.all([
    getTranslations("Merchant.documents"),
    api.store(),
    merchantDocuments(),
    declaration(locale),
    api.products(),
  ]);
  const precious = store.sellerKind !== "FASHION";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <section aria-labelledby="docs-list" className="flex flex-col gap-4">
        <h2 id="docs-list" className="text-2xl">
          {t("listTitle")}
        </h2>
        {docs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {docs.map((d) => (
              <li key={d.id} className="flex gap-3 rounded-lg border bg-card p-4">
                <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t(`kind.${d.kind}`)}</p>
                    <Badge variant={BADGE[d.status]}>{t(`status.${d.status}`)}</Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {t("uploaded", { name: d.fileName, date: day(d.createdAt) })}
                  </p>
                  {d.rejectReason && <p className="text-sm">{t(`reason.${d.rejectReason}`)}</p>}
                  {d.reviewNote && (
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {d.reviewNote}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section
        aria-labelledby="docs-upload"
        className="flex flex-col gap-4 rounded-lg border bg-card p-5"
      >
        <h2 id="docs-upload" className="text-2xl">
          {t("uploadTitle")}
        </h2>
        {!precious || !text ? (
          <p className="text-sm text-muted-foreground">{t("fashionNote")}</p>
        ) : (
          <MerchantIntl>
            <DocumentUpload
              declaration={text}
              products={rows
                .filter((r) => r.materialKind !== "FASHION")
                .map((r) => ({
                  id: r.id,
                  name: r.name[locale as keyof typeof r.name] || r.name.az,
                }))}
            />
          </MerchantIntl>
        )}
      </section>
    </div>
  );
}

export default async function MerchantDocumentsPage() {
  const [t, tm] = await Promise.all([
    getTranslations("Merchant.documents"),
    getTranslations("Merchant"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {USING_MOCK ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {tm("sampleOnly")}
        </p>
      ) : (
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
          <Documents />
        </Suspense>
      )}
    </div>
  );
}
