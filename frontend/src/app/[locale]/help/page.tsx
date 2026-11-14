import {
  BadgeCheck,
  FileUp,
  Flag,
  LifeBuoy,
  Mail,
  MessageCircle,
  Store,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
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
import { faqPage } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";
import { supportContact } from "@/lib/support";

type Section = {
  key: "contact" | "sell" | "documents" | "verified" | "report";
  icon: LucideIcon;
  links?: { href: string; label: "catalog" | "sell" | "merchant" }[];
};

const SECTIONS: Section[] = [
  { key: "contact", icon: MessageCircle, links: [{ href: "/products", label: "catalog" }] },
  {
    key: "sell",
    icon: Store,
    links: [
      { href: "/sell", label: "sell" },
      { href: "/merchant", label: "merchant" },
    ],
  },
  { key: "documents", icon: FileUp },
  { key: "verified", icon: BadgeCheck },
  { key: "report", icon: Flag },
];

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Help" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/help"),
    openGraph: openGraph(locale, "/help"),
  };
}

/**
 * Help and support (#167): where notifications send a seller who has a question, and the
 * answers buyers and sellers ask most. The support contact comes from the public env only;
 * without one the page says so instead of naming an address that does not exist.
 */
export default async function HelpPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const t = await getTranslations({ locale, namespace: "Help" });
  const faq = SECTIONS.map((s) => ({ q: t(`faq.${s.key}.q`), a: t(`faq.${s.key}.a`) }));
  const contact = supportContact();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <JsonLd data={[faqPage(faq)]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="flex flex-col gap-4">
        {SECTIONS.map(({ key, icon: Icon, links }, i) => (
          <Card key={key} role="region" aria-labelledby={`help-${key}`}>
            <CardHeader className="flex flex-row items-start gap-3">
              <Icon aria-hidden className="mt-1 size-5 shrink-0 text-gold-text" />
              <h2 id={`help-${key}`} className="font-sans text-lg font-semibold">
                {faq[i].q}
              </h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="leading-relaxed text-muted-foreground">{faq[i].a}</p>
              {links && (
                <div className="flex flex-wrap gap-2">
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      prefetch={false}
                      className={buttonVariants({
                        variant: "outline",
                        className: "pointer-coarse:h-11",
                      })}
                    >
                      {t(`links.${l.label}`)}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <section
        id="support"
        aria-labelledby="help-support"
        className="flex flex-col gap-3 rounded-xl border bg-muted p-6"
      >
        <div className="flex items-center gap-3">
          <LifeBuoy aria-hidden className="size-5 shrink-0 text-gold-text" />
          <h2 id="help-support" className="font-sans text-lg font-semibold">
            {t("support.title")}
          </h2>
        </div>
        {contact.email || contact.url ? (
          <>
            <p className="leading-relaxed">{t("support.text")}</p>
            <ul className="flex flex-col gap-2">
              {contact.email && (
                <li className="flex items-center gap-2">
                  <Mail aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="sr-only">{t("support.email")}: </span>
                  <a href={`mailto:${contact.email}`} className="link-underline break-all">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.url && (
                <li className="flex items-center gap-2">
                  <ExternalLink aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <a
                    href={contact.url}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="link-underline"
                  >
                    {t("support.url")}
                  </a>
                </li>
              )}
            </ul>
          </>
        ) : (
          <p className="leading-relaxed text-muted-foreground">{t("support.none")}</p>
        )}
      </section>
    </div>
  );
}
