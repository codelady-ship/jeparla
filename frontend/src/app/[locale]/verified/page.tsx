import { BadgeCheck, FileCheck2, Microscope, ShieldAlert, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import { faqPage } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";

const CHECKS = [
  ["seller", BadgeCheck],
  ["documents", FileCheck2],
  ["expertise", Microscope],
] as const satisfies readonly (readonly [string, LucideIcon])[];
const PARTS = ["what", "who", "not"] as const;
const COMPLAINT = ["1", "2", "3"] as const;
const CODE = ["1", "2", "3", "4", "5", "6", "7"] as const;
const FAQ_KEYS = ["meaning", "guarantee", "report"] as const;

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Verified" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/verified"),
    openGraph: openGraph(locale, "/verified"),
  };
}

/**
 * What "Jeparla Verified" means and what it does not (#107). Static text from the
 * message files: renders without JavaScript.
 */
export default async function VerifiedPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const t = await getTranslations({ locale, namespace: "Verified" });
  const faq = FAQ_KEYS.map((k) => ({ q: t(`faq.${k}.q`), a: t(`faq.${k}.a`) }));

  return (
    <article className="container-page flex flex-col gap-14 py-8 sm:py-12">
      <JsonLd data={[faqPage(faq)]} />

      <header className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-4xl leading-tight sm:text-5xl">{t("title")}</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">{t("lead")}</p>
        <p className="text-sm font-medium">{t("badgeRule")}</p>
      </header>

      <section aria-labelledby="checks">
        <h2 id="checks" className="mb-6 text-2xl sm:text-3xl">
          {t("checksTitle")}
        </h2>
        <ol className="grid gap-4 lg:grid-cols-3">
          {CHECKS.map(([key, Icon]) => (
            <li key={key} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Icon aria-hidden className="size-5 text-gold-text" />
                {t(`checks.${key}.title`)}
              </h3>
              <dl className="flex flex-col gap-3 text-sm">
                {PARTS.map((part) => (
                  <div key={part}>
                    <dt className="font-medium">{t(part)}</dt>
                    <dd className="mt-0.5 leading-relaxed text-muted-foreground">
                      {t(`checks.${key}.${part}`)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="limits"
        className="flex max-w-3xl gap-3 rounded-lg border border-gold/40 bg-surface p-5"
      >
        <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-text" />
        <div>
          <h2 id="limits" className="text-lg font-semibold">
            {t("limitsTitle")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed">{t("limits")}</p>
        </div>
      </section>

      <section aria-labelledby="complaint" className="max-w-3xl">
        <h2 id="complaint" className="mb-4 text-2xl sm:text-3xl">
          {t("complaintTitle")}
        </h2>
        <ol className="flex flex-col gap-3">
          {COMPLAINT.map((s) => (
            <li key={s} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums"
              >
                {s}
              </span>
              <p className="leading-relaxed">{t(`complaint.${s}`)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">{t("responseTime")}</p>
      </section>

      <section aria-labelledby="code" className="max-w-3xl">
        <h2 id="code" className="mb-2 text-2xl sm:text-3xl">
          {t("codeTitle")}
        </h2>
        <p className="mb-4 text-muted-foreground">{t("codeIntro")}</p>
        <ol className="flex list-decimal flex-col gap-2 pl-6 marker:text-gold-text">
          {CODE.map((c) => (
            <li key={c} className="pl-1 leading-relaxed">
              {t(`code.${c}`)}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="verified-faq" className="max-w-3xl">
        <h2 id="verified-faq" className="mb-4 text-2xl sm:text-3xl">
          {t("faqTitle")}
        </h2>
        <dl className="flex flex-col divide-y">
          {faq.map((item) => (
            <div key={item.q} className="py-4 first:pt-0">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
