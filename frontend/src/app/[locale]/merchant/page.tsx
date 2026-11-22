import { Eye, MessageCircle, Plus, Undo2 } from "lucide-react";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CodeBanner } from "@/components/merchant/code-banner";
import { DraftResume } from "@/components/merchant/draft-resume";
import {
  MerchantIntl,
  merchantMetadata,
  SellerBanner,
  StatusBadge,
} from "@/components/merchant/merchant-shell";
import { SellerGuide } from "@/components/merchant/seller-guide";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { USING_MOCK } from "@/lib/api";
import { formatDecimal } from "@/lib/money";
import { codeState } from "@/lib/merchant/code";
import { merchantContext } from "@/lib/merchant/server";
import { CONTACT_QUESTIONS } from "@/lib/whatsapp";
import type { ProductStatus } from "@/types/api";

export const generateMetadata = () => merchantMetadata("dashboard");

const ORDER: ProductStatus[] = ["APPROVED", "IN_REVIEW", "DRAFT", "RETURNED", "INACTIVE"];

async function Dashboard() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const { api } = await merchantContext();
  const [t, ts, tq, store, stats, rows] = await Promise.all([
    getTranslations("Merchant.dashboard"),
    getTranslations("Merchant.status"),
    getTranslations("Pdp.contact.questions"),
    api.store(),
    api.dashboard(),
    api.products(),
  ]);
  // Sample data has no acceptance: no banner there (codeVersion comes only from the backend).
  const code = store.codeVersion === undefined ? null : codeState(store, new Date());
  const returned = rows.filter((r) => r.status === "RETURNED");
  const num = (n: number) => formatDecimal(String(n), locale);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro", { store: store.name })}</p>
        </div>
        {/* One primary button per screen (#176): with no products yet, the empty state below
            carries "New product", so the header does not repeat it. */}
        {rows.length > 0 && (
          <Link href="/merchant/products/new" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            {t("newProduct")}
          </Link>
        )}
      </div>

      <SellerBanner status={store.sellerStatus} />
      {code && code.kind !== "valid" && (
        <MerchantIntl>
          <CodeBanner
            kind={code.kind}
            validUntil={
              code.kind === "due"
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: "long",
                    timeZone: "Asia/Baku",
                  }).format(new Date(code.validUntil))
                : undefined
            }
          />
        </MerchantIntl>
      )}
      <MerchantIntl>
        <SellerGuide dismissed={store.guideDismissed === true} />
        <DraftResume />
      </MerchantIntl>

      {rows.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
          <h2 className="text-2xl">{t("emptyTitle")}</h2>
          <p className="max-w-md text-muted-foreground">{t("emptyText")}</p>
          <Link href="/merchant/products/new" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            {t("newProduct")}
          </Link>
        </section>
      ) : (
        <>
          <section aria-label={t("last30")} className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Eye, label: t("views"), value: stats.views },
              { icon: MessageCircle, label: t("whatsappClicks"), value: stats.whatsappClicks },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col gap-2 rounded-lg border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </p>
                  {USING_MOCK && <Badge variant="outline">{t("demoData")}</Badge>}
                </div>
                {value === null ? (
                  // Views are not counted yet: say so instead of showing an invented number.
                  <p className="text-base text-muted-foreground">{t("notCounted")}</p>
                ) : (
                  <p className="text-3xl font-semibold tabular-nums">{num(value)}</p>
                )}
                <p className="text-xs text-muted-foreground">{t("last30")}</p>
              </div>
            ))}
          </section>

          {stats.whatsappClicksByQuestion && stats.whatsappClicks > 0 && (
            <section aria-labelledby="by-question" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="by-question" className="text-xl">
                  {t("byQuestion")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("byQuestionNote")}</p>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {CONTACT_QUESTIONS.map((q) => (
                  <li key={q} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
                    <span className="text-sm text-muted-foreground">{tq(q)}</span>
                    <span className="text-2xl font-semibold tabular-nums">
                      {num(stats.whatsappClicksByQuestion?.[q] ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="by-status" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="by-status" className="text-xl">
                {t("byStatus")}
              </h2>
              <Link href="/merchant/products" className="link-underline text-sm">
                {t("viewAll")}
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {ORDER.map((s) => (
                <li key={s}>
                  <Link
                    href={`/merchant/products?status=${s}`}
                    className="flex flex-col gap-2 rounded-lg border bg-card p-4 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <StatusBadge status={s} label={ts(s)} />
                    <span className="text-2xl font-semibold tabular-nums">
                      {num(stats.counts[s])}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {returned.length > 0 && (
            <section aria-labelledby="returned" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="returned" className="flex items-center gap-2 text-xl">
                  <Undo2 aria-hidden className="size-5 text-destructive" />
                  {t("returned")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("returnedText")}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {returned.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="truncate font-medium">{r.name[locale]}</p>
                      {r.reviewNote && (
                        <p className="text-sm text-muted-foreground">{r.reviewNote}</p>
                      )}
                    </div>
                    <Link
                      href={`/merchant/products/${r.id}/edit`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      {t("fix")}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <Skeleton className="h-28 rounded-lg" />
    </div>
  );
}

export default function MerchantDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
