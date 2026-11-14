import type { Metadata } from "next";
import { Info, Ruler } from "lucide-react";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { RingDiagram } from "@/components/size-guide/ring-diagram";
import { RingSizeHelper } from "@/components/size-guide/ring-size-helper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { breadcrumbs } from "@/lib/seo/json-ld";
import { article, howTo } from "@/lib/seo/guides";
import { openGraph } from "@/lib/seo/open-graph";
import { formatSize, formatTenths, ringTable } from "@/lib/size-guide/ring-size";

const PATH = "/size-guide";
/** Content dates (ISO); change MODIFIED when the guide's facts change. */
const PUBLISHED = "2026-11-11";
const MODIFIED = "2026-11-11";

const RING_STEPS = ["s1", "s2", "s3", "s4"] as const;
const STRING_STEPS = ["s1", "s2", "s3", "s4", "s5"] as const;
const TIPS = ["t1", "t2", "t3", "t4"] as const;
const BRACELETS = ["r1", "r2", "r3", "r4"] as const;
const CHAINS = ["r1", "r2", "r3", "r4", "r5", "r6"] as const;
const SECTIONS = ["rings", "helper", "measure", "bracelets", "chains"] as const;

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "SizeGuide" });
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: alternates(locale, PATH),
    openGraph: openGraph(locale, PATH, { type: "article" }),
  };
}

/** Table with a caption and column headers; scrolls sideways on its own if it must. */
function DataTable({
  id,
  caption,
  head,
  children,
}: {
  id: string;
  caption: string;
  head: string[];
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-labelledby={id}
      tabIndex={0}
      className="overflow-x-auto rounded-lg border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <table className="w-full border-collapse text-sm">
        <caption id={id} className="px-4 pt-3 pb-2 text-left text-sm text-muted-foreground">
          {caption}
        </caption>
        <thead className="bg-surface">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b px-4 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:px-4 [&_td]:py-2 [&_th]:px-4 [&_th]:py-2 [&_tr:not(:last-child)]:border-b">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export default async function SizeGuidePage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const [t, tn, m, format] = await Promise.all([
    getTranslations({ locale, namespace: "SizeGuide" }),
    getTranslations({ locale, namespace: "Nav" }),
    getMessages({ locale }),
    getFormatter({ locale }),
  ]);
  const rows = ringTable();
  const ringSteps = RING_STEPS.map((k) => t(`measure.ringSteps.${k}`));
  const stringSteps = STRING_STEPS.map((k) => t(`measure.stringSteps.${k}`));

  return (
    <article className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          breadcrumbs([
            { name: tn("home"), path: `/${locale}` },
            { name: t("title"), path: `/${locale}${PATH}` },
          ]),
          article({
            locale,
            path: PATH,
            headline: t("title"),
            description: t("description"),
            published: PUBLISHED,
            modified: MODIFIED,
          }),
          howTo({
            locale,
            path: PATH,
            anchor: "measure",
            name: t("howTo.name"),
            description: t("howTo.description"),
            supplies: [t("howTo.supplyStrip")],
            tools: [t("howTo.toolRuler"), t("howTo.toolPen")],
            sections: [
              { name: t("measure.ringTitle"), steps: ringSteps },
              { name: t("measure.stringTitle"), steps: stringSteps },
            ],
          }),
        ]}
      />
      <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-foreground">
              {tn("home")}
            </Link>
          </li>
          <li aria-current="page" className="text-foreground before:mr-1 before:content-['/']">
            {t("title")}
          </li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <h1 className="mb-3 text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-lg leading-relaxed">{t("answer")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("updated")}{" "}
          <time dateTime={MODIFIED}>{format.dateTime(new Date(MODIFIED), "priceUpdated")}</time>
        </p>
      </header>

      <aside
        aria-labelledby="size-honest"
        className="mt-6 flex max-w-3xl gap-3 rounded-lg border border-gold/40 bg-surface p-4"
      >
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-text" />
        <div className="flex flex-col gap-2 text-sm leading-relaxed">
          <h2 id="size-honest" className="font-sans text-base font-semibold">
            {t("honest.title")}
          </h2>
          <p>{t("honest.text")}</p>
          <p className="text-muted-foreground">{t("honest.noPrintable")}</p>
        </div>
      </aside>

      <nav aria-label={t("toc")} className="mt-8">
        <h2 className="sr-only">{t("toc")}</h2>
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <li key={s}>
              <a
                href={`#${s}`}
                className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm hover:bg-muted pointer-coarse:h-11"
              >
                {t(`${s}.title`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <section aria-labelledby="rings" className="flex min-w-0 flex-col gap-4">
          <h2 id="rings" className="scroll-mt-24 text-2xl sm:text-3xl">
            {t("rings.title")}
          </h2>
          <p className="max-w-2xl text-muted-foreground">{t("rings.intro")}</p>
          <DataTable
            id="rings-caption"
            caption={t("rings.caption")}
            head={[
              t("rings.colSize"),
              t("rings.colDiameter"),
              t("rings.colCircumference"),
              t("rings.colIso"),
            ]}
          >
            {rows.map((r) => (
              <tr key={String(r.sizeHalves)} className="tabular-nums">
                <th scope="row" className="text-left font-semibold">
                  {formatSize(r.sizeHalves, locale)}
                </th>
                <td>{formatTenths(r.diameterTenths, locale)}</td>
                <td>{formatTenths(r.circumferenceTenths, locale)}</td>
                <td>{String(r.isoSize)}</td>
              </tr>
            ))}
          </DataTable>
          <div className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            <h3 className="mb-1 font-sans text-sm font-semibold text-foreground">
              {t("rings.sourceTitle")}
            </h3>
            <p>{t("rings.sourceAz")}</p>
            <p className="mt-1">{t("rings.sourceIso")}</p>
            <p className="mt-1">{t("rings.sourceUs")}</p>
            <p className="mt-1">{t("rings.rounding")}</p>
          </div>
        </section>

        <section aria-labelledby="helper" className="lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2 id="helper" className="flex scroll-mt-24 items-center gap-2 text-2xl">
                  <Ruler aria-hidden className="size-5 text-gold-text" />
                  {t("helper.title")}
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t("helper.intro")}</p>
              <IntlProvider
                locale={locale}
                messages={{ SizeGuide: { helper: m.SizeGuide.helper } } as typeof m}
              >
                <RingSizeHelper />
              </IntlProvider>
              <p className="text-xs text-muted-foreground">{t("helper.tie")}</p>
            </CardContent>
          </Card>
        </section>
      </div>

      <section aria-labelledby="measure" className="mt-16 flex flex-col gap-6">
        <h2 id="measure" className="scroll-mt-24 text-2xl sm:text-3xl">
          {t("measure.title")}
        </h2>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem]">
          <div>
            <h3 className="mb-3 font-sans text-base font-semibold">{t("measure.ringTitle")}</h3>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
              {ringSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="mb-3 font-sans text-base font-semibold">{t("measure.stringTitle")}</h3>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
              {stringSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <RingDiagram
            title={t("measure.diagram.title")}
            desc={t("measure.diagram.desc")}
            diameter={t("measure.diagram.diameter")}
            circumference={t("measure.diagram.circumference")}
          />
        </div>
        <div className="max-w-3xl">
          <h3 className="mb-3 font-sans text-base font-semibold">{t("measure.tipsTitle")}</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            {TIPS.map((k) => (
              <li key={k}>{t(`measure.tips.${k}`)}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="bracelets" className="flex min-w-0 flex-col gap-4">
          <h2 id="bracelets" className="scroll-mt-24 text-2xl sm:text-3xl">
            {t("bracelets.title")}
          </h2>
          <p className="text-muted-foreground">{t("bracelets.intro")}</p>
          <DataTable
            id="bracelets-caption"
            caption={t("bracelets.caption")}
            head={[t("bracelets.colLength"), t("bracelets.colUse")]}
          >
            {BRACELETS.map((k) => (
              <tr key={k}>
                <th scope="row" className="text-left font-semibold whitespace-nowrap">
                  {t(`bracelets.rows.${k}.length`)}
                </th>
                <td>{t(`bracelets.rows.${k}.use`)}</td>
              </tr>
            ))}
          </DataTable>
          <p className="text-sm leading-relaxed">{t("bracelets.bangle")}</p>
          <p className="text-xs text-muted-foreground">{t("bracelets.note")}</p>
        </section>

        <section aria-labelledby="chains" className="flex min-w-0 flex-col gap-4">
          <h2 id="chains" className="scroll-mt-24 text-2xl sm:text-3xl">
            {t("chains.title")}
          </h2>
          <p className="text-muted-foreground">{t("chains.intro")}</p>
          <DataTable
            id="chains-caption"
            caption={t("chains.caption")}
            head={[t("chains.colLength"), t("chains.colUse")]}
          >
            {CHAINS.map((k) => (
              <tr key={k}>
                <th scope="row" className="text-left font-semibold whitespace-nowrap">
                  {t(`chains.rows.${k}.length`)}
                </th>
                <td>{t(`chains.rows.${k}.use`)}</td>
              </tr>
            ))}
          </DataTable>
          <p className="text-sm leading-relaxed">{t("chains.note")}</p>
        </section>
      </div>

      <section aria-labelledby="sources" className="mt-16 max-w-3xl border-t pt-6">
        <h2 id="sources" className="mb-3 font-sans text-base font-semibold">
          {t("sources.title")}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>{t("sources.iso")}</li>
          <li>{t("sources.trade")}</li>
          <li>{t("sources.lengths")}</li>
        </ul>
      </section>
    </article>
  );
}
