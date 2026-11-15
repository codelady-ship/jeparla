import { Eye, MessageCircle } from "lucide-react";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { merchantMetadata } from "@/components/merchant/merchant-shell";
import { ShareCatalog } from "@/components/merchant/share-catalog";
import { shareLabels } from "@/components/share/share-labels";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { USING_MOCK } from "@/lib/api";
import { merchantContext } from "@/lib/merchant/server";
import { REFERRAL_DAYS, type ReferralDays } from "@/types/share";
import { cn } from "cn";

export const generateMetadata = () => merchantMetadata("share");

const parseDays = (raw: string | string[] | undefined): ReferralDays =>
  REFERRAL_DAYS.find((d) => String(d) === raw) ?? 30;

/** Bio and post links with a source, so the statistics can say where visitors came from. */
const SOURCE_LINKS = ["instagram", "tiktok", "whatsapp", "tapaz"] as const;

type SP = PageProps<"/[locale]/merchant/share">["searchParams"];

async function Share({ searchParams }: { searchParams: SP }) {
  const days = parseDays((await searchParams).days);
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const { api } = await merchantContext();
  const [t, format, store, link, stats, share] = await Promise.all([
    getTranslations("Merchant.share"),
    getFormatter(),
    api.store(),
    api.share(),
    api.referrals(days),
    shareLabels(),
  ]);
  const num = (n: number) => format.number(n);
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00+04:00`), {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Baku",
    });
  const active = stats.daily.filter((d) => d.visits > 0 || d.whatsappClicks > 0).reverse();

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="share-link" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 id="share-link" className="text-3xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
        </div>
        <ShareCatalog
          link={link}
          storeName={store.name}
          qrAvailable={!USING_MOCK}
          labels={{
            linkLabel: t("linkLabel"),
            qrTitle: t("qrTitle"),
            qrAlt: t("qrAlt", { store: store.name }),
            qrUnavailable: t("qrUnavailable"),
            downloadPng: t("downloadPng"),
            print: t("print"),
            inactive: t("inactive"),
            regenerate: t("regenerate"),
            regenerateTitle: t("regenerateTitle"),
            regenerateText: t("regenerateText"),
            regenerateConfirm: t("regenerateConfirm"),
            cancel: t("cancel"),
            regenerated: t("regenerated"),
            failed: t("failed"),
            share,
          }}
        />
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">{t("sourcesTitle")}</p>
          <p className="text-muted-foreground">{t("sourcesText")}</p>
          <ul className="flex flex-col gap-1 font-mono text-xs break-all">
            {SOURCE_LINKS.map((s) => (
              <li key={s}>{`${link.url}?ref=${s}`}</li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="share-stats" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 id="share-stats" className="flex items-center gap-2 text-2xl">
              {t("statsTitle")}
              {USING_MOCK && <Badge variant="outline">{t("demoData")}</Badge>}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("statsSince", { from: day(stats.from), to: day(stats.to) })}
            </p>
          </div>
          <nav aria-label={t("window")} className="flex gap-1">
            {REFERRAL_DAYS.map((d) => (
              <Link
                key={d}
                href={`/merchant/share?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  d === days ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {t("days", { days: d })}
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Eye, label: t("visits"), value: stats.visits },
            { icon: MessageCircle, label: t("whatsappClicks"), value: stats.whatsappClicks },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col gap-2 rounded-lg border bg-card p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon aria-hidden className="size-4" />
                {label}
              </p>
              <p className="text-3xl font-semibold tabular-nums">{num(value)}</p>
            </div>
          ))}
        </div>

        {stats.sources.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <table className="w-full text-sm">
              <caption className="mb-2 text-left font-medium">{t("bySource")}</caption>
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 text-left font-normal">
                    {t("source")}
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    {t("visits")}
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    {t("whatsappClicks")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.sources.map((s) => (
                  <tr key={s.source} className="border-b last:border-0">
                    <th scope="row" className="py-2 text-left font-medium">
                      {t(`sources.${s.source}`)}
                    </th>
                    <td className="py-2 text-right tabular-nums">{num(s.visits)}</td>
                    <td className="py-2 text-right tabular-nums">{num(s.whatsappClicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full text-sm">
              <caption className="mb-2 text-left font-medium">{t("byDay")}</caption>
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 text-left font-normal">
                    {t("day")}
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    {t("visits")}
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    {t("whatsappClicks")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((d) => (
                  <tr key={d.day} className="border-b last:border-0">
                    <th scope="row" className="py-2 text-left font-medium">
                      <time dateTime={d.day}>{day(d.day)}</time>
                    </th>
                    <td className="py-2 text-right tabular-nums">{num(d.visits)}</td>
                    <td className="py-2 text-right tabular-nums">{num(d.whatsappClicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("privacy")}</p>
      </section>
    </div>
  );
}

function ShareSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-48 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    </div>
  );
}

export default function MerchantSharePage({ searchParams }: PageProps<"/[locale]/merchant/share">) {
  return (
    <Suspense fallback={<ShareSkeleton />}>
      <Share searchParams={searchParams} />
    </Suspense>
  );
}
