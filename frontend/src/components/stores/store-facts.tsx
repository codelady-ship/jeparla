import { CalendarDays, FileCheck, Package, RefreshCw, Scale, Stamp, Gem } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { TermHint } from "@/components/pdp/term-hint";
import type { StoreFacts as Facts } from "@/types/share";

type FactKey =
  "since" | "products" | "updated" | "metalLinked" | "hallmark" | "expertise" | "documents";
type Row = { key: FactKey; icon: LucideIcon; value: string; dateTime?: string };

/**
 * Measured trust facts of a store (#108). Every value comes from GET /stores/{slug}/facts,
 * which counts it from the database; a fact the API does not know (null) is left out rather
 * than shown as 0 %. No rating, no review count, no WhatsApp response time: none is measured.
 * The "how is it counted" texts follow backend/README.md ("Mağaza faktları").
 */
export async function StoreFacts({ facts }: { facts: Facts }) {
  const [t, format] = await Promise.all([getTranslations("Stores.facts"), getFormatter()]);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { year: "numeric", month: "long", day: "numeric" });
  const total = facts.activeProducts;
  const rows: Row[] = [];

  if (facts.onJeparlaSince)
    rows.push({
      key: "since",
      icon: CalendarDays,
      value: t("sinceValue", {
        date: format.dateTime(new Date(facts.onJeparlaSince), { year: "numeric", month: "long" }),
        months: facts.monthsOnJeparla ?? 0,
      }),
      dateTime: facts.onJeparlaSince,
    });
  rows.push({ key: "products", icon: Package, value: t("productsValue", { count: total }) });
  if (facts.catalogUpdatedAt)
    rows.push({
      key: "updated",
      icon: RefreshCw,
      value: date(facts.catalogUpdatedAt),
      dateTime: facts.catalogUpdatedAt,
    });
  const shares = [
    ["metalLinked", Scale, facts.metalLinkedPrice],
    ["hallmark", Stamp, facts.hallmarkPhoto],
    ["expertise", Gem, facts.verifiedExpertise],
  ] as const;
  for (const [key, icon, share] of shares) {
    if (!share || share.percent === null) continue;
    rows.push({
      key,
      icon,
      value: t("shareValue", { percent: share.percent, count: share.count, total }),
    });
  }
  if (facts.documents)
    rows.push({
      key: "documents",
      icon: FileCheck,
      value: [
        t(facts.documents.taxId ? "taxIdVerified" : "taxIdNot"),
        t(facts.documents.tradeLicense ? "licenseVerified" : "licenseNot"),
      ].join(", "),
    });

  return (
    <section aria-labelledby="store-facts" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="store-facts" className="text-xl">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ key, icon: Icon, value, dateTime }) => (
          // dt and dd sit directly in the div (a dl allows no deeper wrapper); the icon is
          // placed inside dt and positioned against the card.
          <div
            key={key}
            className="relative flex min-w-0 flex-col gap-0.5 rounded-lg border bg-card p-3 pl-10"
          >
            <dt className="text-sm text-muted-foreground">
              <Icon aria-hidden className="absolute top-3.5 left-3 size-4 text-gold-text" />
              {t(`${key}.label`)}
              <TermHint
                term={t(`${key}.label`)}
                label={t("how", { fact: t(`${key}.label`) })}
                text={t(`${key}.how`)}
              />
            </dt>
            <dd className="font-medium">
              {dateTime ? <time dateTime={dateTime}>{value}</time> : value}
            </dd>
          </div>
        ))}
      </dl>
      {total === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
    </section>
  );
}
