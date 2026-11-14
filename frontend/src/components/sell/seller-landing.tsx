import {
  BadgeCheck,
  Check,
  Link2,
  MessageCircle,
  Minus,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { faqPage } from "@/lib/seo/json-ld";
import { cn } from "cn";

const VALUES = [
  ["catalog", Link2],
  ["price", RefreshCw],
  ["verified", BadgeCheck],
  ["search", Search],
  ["whatsapp", MessageCircle],
] as const satisfies readonly (readonly [string, LucideIcon])[];
const STEPS = ["1", "2", "3"] as const;
const FAQ_KEYS = ["fee", "documents", "time", "prices", "sales"] as const;

type Mark = "yes" | "no" | "partly";
const COLUMNS = ["bio", "classifieds", "jeparla"] as const;
// Features only, no names or logos of other services (clean-room, #110).
const ROWS = [
  ["structured", ["no", "partly", "yes"]],
  ["autoPrice", ["no", "no", "yes"]],
  ["filters", ["no", "partly", "yes"]],
  ["verified", ["no", "no", "yes"]],
  ["whatsapp", ["yes", "partly", "yes"]],
  ["free", ["yes", "partly", "yes"]],
] as const satisfies readonly (readonly [string, readonly [Mark, Mark, Mark]])[];
const MARK_ICON: Record<Mark, LucideIcon> = { yes: Check, no: X, partly: Minus };

/**
 * "For sellers" introduction above the registration wizard on /sell: why Jeparla,
 * what it costs, how long it takes. No seller counts or reviews: none are invented.
 */
export async function SellerLanding({
  locale,
  demoStore,
}: {
  locale: Locale;
  /** A sample store to look at; only passed while the site shows demo data. */
  demoStore: string | null;
}) {
  const t = await getTranslations({ locale, namespace: "SellLanding" });
  const faq = FAQ_KEYS.map((k) => ({ q: t(`faq.${k}.q`), a: t(`faq.${k}.a`) }));

  return (
    <div className="flex flex-col gap-16">
      <JsonLd data={[faqPage(faq)]} />

      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium tracking-wide text-gold-text uppercase">{t("eyebrow")}</p>
        <h1 className="max-w-3xl text-4xl leading-tight text-balance sm:text-5xl">{t("title")}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{t("lead")}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <a href="#start" className={cn(buttonVariants({ variant: "gold", size: "lg" }), "h-12")}>
            {t("start")}
          </a>
          <a href="#how" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12")}>
            {t("seeHow")}
          </a>
        </div>
      </header>

      <section aria-labelledby="values">
        <h2 id="values" className="mb-6 text-2xl sm:text-3xl">
          {t("valuesTitle")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map(([key, Icon], i) => (
            <Reveal as="li" key={key} index={i} className="rounded-lg border bg-card p-5">
              <Icon aria-hidden className="mb-3 size-6 text-gold-text" />
              <h3 className="font-semibold">{t(`values.${key}.title`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(`values.${key}.text`)}
              </p>
            </Reveal>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-title" id="how" className="scroll-mt-24">
        <h2 id="how-title" className="mb-6 text-2xl sm:text-3xl">
          {t("howTitle")}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s} index={i} className="flex gap-4 rounded-lg border p-5">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums"
              >
                {s}
              </span>
              <div>
                <h3 className="font-semibold">{t(`steps.${s}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`steps.${s}.text`)}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
        {demoStore && (
          <p className="mt-4 text-sm">
            <Link
              href={`/stores/${demoStore}`}
              prefetch={false}
              className="link-underline font-medium"
            >
              {t("demo")}
            </Link>
            <span className="block text-muted-foreground">{t("demoNote")}</span>
          </p>
        )}
      </section>

      <section aria-labelledby="compare">
        <h2 id="compare" className="mb-2 text-2xl sm:text-3xl">
          {t("compareTitle")}
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("compareIntro")}</p>
        {/* Scrolls sideways on phones: focusable so keyboard users can scroll it too. */}
        <div
          className="overflow-x-auto rounded-lg border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          tabIndex={0}
          role="region"
          aria-labelledby="compare"
        >
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">{t("compareCaption")}</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th scope="col" className="p-3 font-medium">
                  {t("feature")}
                </th>
                {COLUMNS.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn("p-3 font-medium", c === "jeparla" && "text-gold-text")}
                  >
                    {t(`columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([row, marks]) => (
                <tr key={row} className="border-b last:border-0">
                  <th scope="row" className="p-3 text-left font-normal">
                    {t(`rows.${row}`)}
                  </th>
                  {marks.map((mark, i) => {
                    const Icon = MARK_ICON[mark];
                    return (
                      <td key={COLUMNS[i]} className="p-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5",
                            mark === "yes" ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          <Icon
                            aria-hidden
                            className={cn("size-4", mark === "yes" && "text-success")}
                          />
                          {t(mark)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="seller-faq">
        <h2 id="seller-faq" className="mb-4 text-2xl sm:text-3xl">
          {t("faqTitle")}
        </h2>
        <dl className="flex max-w-3xl flex-col divide-y">
          {faq.map((item) => (
            <div key={item.q} className="py-4 first:pt-0">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
