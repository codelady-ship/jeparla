import { getLocale, getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { faqPage, organization, website } from "@/lib/seo/json-ld";
import { FaqList } from "@/components/faq-list";

const FAQ_KEYS = ["what", "buy", "price", "verified", "sell"] as const;

/**
 * Plain, quotable answers to"what is Jeparla": search engines and AI assistants use
 * this text and the matching Organization / WebSite / FAQPage data (issue #61).
 */
export async function AboutJeparla() {
  const [t, tm, locale] = await Promise.all([
    getTranslations("About"),
    getTranslations("Metadata"),
    getLocale(),
  ]);
  const faq = FAQ_KEYS.map((k) => ({ q: t(`faq.${k}.q`), a: t(`faq.${k}.a`) }));

  return (
    <section aria-labelledby="about" className="border-t bg-card">
      <JsonLd
        data={[organization(tm("description")), website(locale, tm("description")), faqPage(faq)]}
      />
      <div className="container-page grid gap-10 py-16 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <h2 id="about" className="mb-4 text-2xl sm:text-3xl">
            {t("title")}
          </h2>
          <p className="leading-relaxed">{t("lead")}</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">{t("how")}</p>
        </Reveal>
        <Reveal index={1}>
          <h2 className="mb-4 text-2xl sm:text-3xl">{t("faqTitle")}</h2>
          <FaqList items={faq} />
        </Reveal>
      </div>
    </section>
  );
}
