import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { GuideAnchor, GuideSections, GuideSources } from "@/components/guides/guide-content";
import { JsonLd } from "@/components/seo/json-ld";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  GUIDE_SLUGS,
  GUIDES_MODIFIED,
  GUIDES_PATH,
  GUIDES_PUBLISHED,
  getGuide,
  guideArticle,
  guidePath,
  isGuideSlug,
  listGuides,
} from "@/lib/guides";
import { breadcrumbs } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await rootLocale();
  if (!isGuideSlug(slug) || !hasLocale(routing.locales, locale)) return {};
  const g = getGuide(locale, slug);
  const path = guidePath(slug);
  return {
    title: g.title,
    description: g.description,
    alternates: alternates(locale, path),
    openGraph: openGraph(locale, path, {
      type: "article",
      publishedTime: GUIDES_PUBLISHED,
      modifiedTime: GUIDES_MODIFIED,
    }),
  };
}

export default async function GuidePage({ params }: PageProps<"/[locale]/guides/[slug]">) {
  const { slug } = await params;
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  if (!isGuideSlug(slug)) notFound();
  const [t, tn, format] = await Promise.all([
    getTranslations({ locale, namespace: "Guides" }),
    getTranslations({ locale, namespace: "Nav" }),
    getFormatter({ locale }),
  ]);
  const g = getGuide(locale, slug);
  const others = listGuides(locale).filter((o) => o.slug !== slug);
  const external = t("external");
  const date = (iso: string) => (
    <time dateTime={iso}>{format.dateTime(new Date(iso), "priceUpdated")}</time>
  );

  return (
    <article className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          breadcrumbs([
            { name: tn("home"), path: `/${locale}` },
            { name: t("title"), path: `/${locale}${GUIDES_PATH}` },
            { name: g.title, path: `/${locale}${guidePath(slug)}` },
          ]),
          guideArticle(g, locale, t("authorName")),
        ]}
      />
      <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-foreground">
              {tn("home")}
            </Link>
          </li>
          <li className="before:mr-1 before:content-['/']">
            <Link href={GUIDES_PATH} className="hover:text-foreground">
              {t("title")}
            </Link>
          </li>
          <li aria-current="page" className="text-foreground before:mr-1 before:content-['/']">
            {g.title}
          </li>
        </ol>
      </nav>

      <div className="max-w-3xl">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl sm:text-4xl">{g.title}</h1>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t("author")}: {t("authorName")}
            </span>
            <span>
              {t("published")}: {date(GUIDES_PUBLISHED)}
            </span>
            {GUIDES_MODIFIED !== GUIDES_PUBLISHED && (
              <span>
                {t("updated")}: {date(GUIDES_MODIFIED)}
              </span>
            )}
          </p>
          <section
            aria-labelledby="short-answer"
            className="rounded-lg border border-gold/40 bg-surface p-5"
          >
            <h2 id="short-answer" className="mb-2 font-sans text-sm font-semibold">
              {t("shortAnswer")}
            </h2>
            <p className="text-lg leading-relaxed">{g.answer}</p>
          </section>
        </header>

        <nav aria-labelledby="toc" className="mt-8">
          <h2 id="toc" className="mb-3 font-sans text-sm font-semibold">
            {t("toc")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {[...g.sections, { id: "sources", title: t("sources") }].map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm hover:bg-muted pointer-coarse:h-11"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 flex flex-col gap-10">
          <GuideSections sections={g.sections} externalLabel={external} />
          <GuideSources
            sources={g.sources}
            title={t("sources")}
            note={t("sourcesNote")}
            externalLabel={external}
          />
        </div>

        <aside aria-labelledby="more-guides" className="mt-12 border-t pt-8">
          <h2 id="more-guides" className="mb-4 text-2xl">
            {t("more")}
          </h2>
          <ul className="flex flex-col gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <GuideAnchor
                  link={{ label: o.title, href: guidePath(o.slug) }}
                  externalLabel={external}
                />
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </article>
  );
}
