import type { Metadata } from "next";
import { ArrowRight, BookOpen } from "lucide-react";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { GUIDES_PATH, guideList, guidePath, listGuides } from "@/lib/guides";
import { breadcrumbs } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Guides" });
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: alternates(locale, GUIDES_PATH),
    openGraph: openGraph(locale, GUIDES_PATH),
  };
}

export default async function GuidesPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const [t, tn] = await Promise.all([
    getTranslations({ locale, namespace: "Guides" }),
    getTranslations({ locale, namespace: "Nav" }),
  ]);
  const guides = listGuides(locale);

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          breadcrumbs([
            { name: tn("home"), path: `/${locale}` },
            { name: t("title"), path: `/${locale}${GUIDES_PATH}` },
          ]),
          guideList(guides, locale),
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

      <header className="mb-8 max-w-3xl">
        <h1 className="mb-3 text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">{t("intro")}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((g) => (
          <li key={g.slug} className="flex">
            <Card className="relative w-full transition-colors hover:border-gold/60">
              <CardHeader className="gap-3">
                <BookOpen aria-hidden className="size-5 text-gold-text" />
                <CardTitle>
                  <h2 className="text-xl">
                    {/* The whole card is clickable through the stretched link. */}
                    <Link
                      href={guidePath(g.slug)}
                      className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                    >
                      {g.title}
                    </Link>
                  </h2>
                </CardTitle>
                <CardDescription className="leading-relaxed">{g.description}</CardDescription>
                <span
                  aria-hidden
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-gold-text"
                >
                  {t("readGuide")}
                  <ArrowRight className="size-3.5" />
                </span>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
