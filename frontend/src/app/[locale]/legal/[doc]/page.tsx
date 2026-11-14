import { FilePenLine } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { isLegalDoc, LEGAL_DOCS, LEGAL_DRAFT, legalDoc } from "@/content/legal";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import { openGraph } from "@/lib/seo/open-graph";

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const d = legalDoc(locale, doc);
  return {
    title: d.title,
    description: d.description,
    alternates: alternates(locale, `/legal/${doc}`),
    openGraph: openGraph(locale, `/legal/${doc}`),
    // A draft is not the operator's statement yet: keep it out of search results (#56, #57).
    ...(LEGAL_DRAFT && { robots: { index: false, follow: true } }),
  };
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const d = legalDoc(locale, doc);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl sm:text-4xl">{d.title}</h1>
        <p className="text-muted-foreground">{d.description}</p>
        {LEGAL_DRAFT && (
          <p role="note" className="rounded-md border border-warning bg-surface p-4 text-sm">
            <strong className="font-semibold">{t("draftTitle")}</strong> {t("draftText")}
          </p>
        )}
      </header>
      {d.sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-3">
          <h2 className="text-2xl">{s.heading}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p} className="leading-relaxed">
              {p}
            </p>
          ))}
          {s.items && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {s.review && (
            <p className="flex gap-2 rounded-md border border-dashed bg-muted p-3 text-sm text-muted-foreground">
              <FilePenLine aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold text-foreground">{t("reviewLabel")}</span> {s.review}
              </span>
            </p>
          )}
        </section>
      ))}
    </article>
  );
}
