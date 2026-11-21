import { BadgeCheck, Coins, Search, Store, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/json-ld";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { operatorDetails } from "@/lib/operator";
import { breadcrumbs, webPage } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";

const PATH = "/about";

type Section = {
  key: "buyers" | "prices" | "checks" | "sellers";
  icon: LucideIcon;
  link: { href: string; label: "catalog" | "prices" | "verified" | "sell" };
};

const SECTIONS: Section[] = [
  { key: "buyers", icon: Search, link: { href: "/products", label: "catalog" } },
  { key: "prices", icon: Coins, link: { href: "/prices", label: "prices" } },
  { key: "checks", icon: BadgeCheck, link: { href: "/verified", label: "verified" } },
  { key: "sellers", icon: Store, link: { href: "/sell", label: "sell" } },
];

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "AboutPage" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, PATH),
    openGraph: openGraph(locale, PATH),
  };
}

/**
 * About Jeparla: what the catalog is and is not, in the words of docs/PLAN.md. No numbers
 * and no promises; the operator's name is shown only when it is configured.
 */
export default async function AboutPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const t = await getTranslations({ locale, namespace: "AboutPage" });
  const tn = await getTranslations({ locale, namespace: "Nav" });
  const operator = operatorDetails();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <JsonLd
        data={[
          breadcrumbs([
            { name: tn("home"), path: `/${locale}` },
            { name: t("title"), path: `/${locale}${PATH}` },
          ]),
          webPage({ locale, path: PATH, name: t("title"), description: t("description") }),
        ]}
      />
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-lg leading-relaxed">{t("intro")}</p>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">{t("notAShop")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ key, icon: Icon, link }) => (
          <Card key={key} role="region" aria-labelledby={`about-${key}`}>
            <CardHeader className="flex flex-row items-start gap-3">
              <Icon aria-hidden className="mt-1 size-5 shrink-0 text-gold-text" />
              <h2 id={`about-${key}`} className="font-sans text-lg font-semibold">
                {t(`sections.${key}.title`)}
              </h2>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-start gap-4">
              <p className="leading-relaxed text-muted-foreground">{t(`sections.${key}.text`)}</p>
              <Link
                href={link.href}
                prefetch={false}
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-auto pointer-coarse:h-11",
                })}
              >
                {t(`links.${link.label}`)}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <section
        aria-labelledby="about-contact"
        className="flex flex-col items-start gap-3 rounded-xl border bg-muted p-6"
      >
        <h2 id="about-contact" className="font-sans text-lg font-semibold">
          {t("contact.title")}
        </h2>
        {operator.name && (
          <p className="leading-relaxed">{t("contact.operator", { name: operator.name })}</p>
        )}
        <p className="leading-relaxed text-muted-foreground">{t("contact.text")}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/contact"
            prefetch={false}
            className={buttonVariants({ className: "pointer-coarse:h-11" })}
          >
            {t("links.contact")}
          </Link>
          <Link
            href="/help"
            prefetch={false}
            className={buttonVariants({ variant: "outline", className: "pointer-coarse:h-11" })}
          >
            {t("links.help")}
          </Link>
        </div>
      </section>
    </div>
  );
}
