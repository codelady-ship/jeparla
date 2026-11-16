import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import {
  CONTACT_SECTION,
  isLegalDoc,
  LEGAL_DOCS,
  LEGAL_UPDATED,
  legalDoc,
  OPERATOR_SECTION,
} from "@/content/legal";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { operatorDetails } from "@/lib/operator";
import { webPage } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";
import { supportContact } from "@/lib/support";

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
  };
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const format = await getFormatter({ locale });
  const d = legalDoc(locale, doc);
  const others = LEGAL_DOCS.filter((id) => id !== doc).map((id) => ({
    id,
    title: legalDoc(locale, id).title,
  }));
  const operator = operatorDetails();
  const contact = supportContact();
  const updated = format.dateTime(new Date(`${LEGAL_UPDATED}T12:00:00+04:00`), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Baku",
  });

  const ownerValue = (value: string | null) =>
    value ?? <span className="font-medium text-warning">{t("ownerField")}</span>;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <JsonLd
        data={[
          webPage({
            locale,
            path: `/legal/${doc}`,
            name: d.title,
            description: d.description,
            dateModified: LEGAL_UPDATED,
          }),
        ]}
      />
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl sm:text-4xl">{d.title}</h1>
        <p className="text-muted-foreground">{d.description}</p>
        <p className="text-sm text-muted-foreground">
          {t.rich("updated", {
            date: updated,
            time: (chunks) => <time dateTime={LEGAL_UPDATED}>{chunks}</time>,
          })}
        </p>
      </header>
      {Object.entries(d.sections).map(([id, s]) => (
        <section
          key={id}
          id={id}
          aria-labelledby={`${id}-title`}
          className="flex scroll-mt-24 flex-col gap-3"
        >
          <h2 id={`${id}-title`} className="text-2xl">
            {s.heading}
          </h2>
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
          {id === OPERATOR_SECTION && (
            <dl className="grid gap-x-6 gap-y-2 rounded-md border bg-surface p-4 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">{t("operatorName")}</dt>
              <dd>{ownerValue(operator.name)}</dd>
              <dt className="text-muted-foreground">{t("operatorTaxId")}</dt>
              <dd>{ownerValue(operator.taxId)}</dd>
              <dt className="text-muted-foreground">{t("operatorAddress")}</dt>
              <dd>{ownerValue(operator.address)}</dd>
            </dl>
          )}
          {id === CONTACT_SECTION && (
            <div className="flex flex-col gap-1 rounded-md border bg-surface p-4 text-sm">
              {contact.email && (
                <p>
                  {t("contactEmail")}:{" "}
                  <a href={`mailto:${contact.email}`} className="link-underline font-medium">
                    {contact.email}
                  </a>
                </p>
              )}
              {contact.url && (
                <p>
                  {t("contactUrl")}:{" "}
                  <a
                    href={contact.url}
                    rel="noopener noreferrer"
                    className="link-underline font-medium"
                  >
                    {contact.url}
                  </a>
                </p>
              )}
              {!contact.email && !contact.url && (
                <p>
                  {t("contactHelp")}{" "}
                  <Link href="/help" className="link-underline font-medium">
                    {t("helpLink")}
                  </Link>
                </p>
              )}
            </div>
          )}
        </section>
      ))}
      <nav aria-label={t("nav")} className="flex flex-col gap-2 border-t pt-6 text-sm">
        <h2 className="font-sans text-base font-semibold">{t("nav")}</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {others.map((o) => (
            <li key={o.id}>
              <Link href={`/legal/${o.id}`} className="link-underline">
                {o.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
