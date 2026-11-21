import {
  ExternalLink,
  Flag,
  LifeBuoy,
  Mail,
  MessageCircle,
  Store,
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
import { breadcrumbs, webPage } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";
import { supportContact } from "@/lib/support";

const PATH = "/contact";

type Topic = {
  key: "product" | "seller" | "report";
  icon: LucideIcon;
  links: { href: string; label: "catalog" | "sell" | "merchant" | "help" }[];
};

const TOPICS: Topic[] = [
  { key: "product", icon: MessageCircle, links: [{ href: "/products", label: "catalog" }] },
  {
    key: "seller",
    icon: Store,
    links: [
      { href: "/sell", label: "sell" },
      { href: "/merchant", label: "merchant" },
    ],
  },
  { key: "report", icon: Flag, links: [{ href: "/help", label: "help" }] },
];

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "ContactPage" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, PATH),
    openGraph: openGraph(locale, PATH),
  };
}

/**
 * Contact: who to write to for what. A question about a product goes to its store; Jeparla's
 * own address comes from the public env (as on the help page) and nothing is invented when
 * it is not set.
 */
export default async function ContactPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const t = await getTranslations({ locale, namespace: "ContactPage" });
  const th = await getTranslations({ locale, namespace: "Help" });
  const tn = await getTranslations({ locale, namespace: "Nav" });
  const contact = supportContact();

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
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </div>

      <section
        aria-labelledby="contact-support"
        className="flex flex-col gap-3 rounded-xl border bg-muted p-6"
      >
        <div className="flex items-center gap-3">
          <LifeBuoy aria-hidden className="size-5 shrink-0 text-gold-text" />
          <h2 id="contact-support" className="font-sans text-lg font-semibold">
            {t("support.title")}
          </h2>
        </div>
        {contact.email || contact.url ? (
          <>
            <p className="leading-relaxed">{th("support.text")}</p>
            <ul className="flex flex-col gap-2">
              {contact.email && (
                <li className="flex items-center gap-2">
                  <Mail aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="sr-only">{th("support.email")}: </span>
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
                    {th("support.url")}
                  </a>
                </li>
              )}
            </ul>
          </>
        ) : (
          <p className="leading-relaxed text-muted-foreground">{th("support.none")}</p>
        )}
      </section>

      <div className="flex flex-col gap-4">
        {TOPICS.map(({ key, icon: Icon, links }) => (
          <Card key={key} role="region" aria-labelledby={`contact-${key}`}>
            <CardHeader className="flex flex-row items-start gap-3">
              <Icon aria-hidden className="mt-1 size-5 shrink-0 text-gold-text" />
              <h2 id={`contact-${key}`} className="font-sans text-lg font-semibold">
                {t(`topics.${key}.title`)}
              </h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="leading-relaxed text-muted-foreground">{t(`topics.${key}.text`)}</p>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
