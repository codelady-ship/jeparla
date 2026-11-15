import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import type { Category, StoreSummary } from "@/types/api";

const FAQ = ["what", "buy", "price", "verified", "sell"] as const;
const METHOD = ["source", "gram", "fineness", "weekend", "jewelry"] as const;
const LANGS = [
  ["az", "Azərbaycanca", az],
  ["en", "English", en],
  ["ru", "Русский", ru],
] as const;

/** Key pages of one language as llms.txt link lines. */
function keyPages(site: string, code: string, m: (typeof LANGS)[number][2]): string[] {
  return [
    `- [${m.Nav.home}](${site}/${code}): ${m.Metadata.description}`,
    `- [${m.Catalog.title}](${site}/${code}/products): ${m.Catalog.description}`,
    `- [${m.Categories.title}](${site}/${code}/categories): ${m.Categories.description}`,
    `- [${m.Stores.title}](${site}/${code}/stores): ${m.Stores.description}`,
    `- [${m.PricesPage.title}](${site}/${code}/prices): ${m.PricesPage.description}`,
    `- [${m.PricesMonthly.title}](${site}/${code}/prices/monthly): ${m.PricesMonthly.description}`,
  ];
}

/**
 * /llms.txt content (llmstxt.org), built from the same messages the site shows, so AI
 * assistants read exactly what visitors read. No figures that are not on the site.
 */
export function buildLlmsTxt(site: string): string {
  const out: string[] = ["# Jeparla", "", `> ${en.About.lead}`, "", en.About.how, ""];
  for (const [code, label, m] of LANGS) {
    out.push(`## ${label} (${code})`, "", ...keyPages(site, code, m), "");
    for (const k of FAQ) out.push(`### ${m.About.faq[k].q}`, "", m.About.faq[k].a, "");
  }
  out.push(
    "## Optional",
    "",
    `- [Full text for language models](${site}/llms-full.txt)`,
    `- [Sitemap](${site}/sitemap.xml)`,
    "",
  );
  return out.join("\n");
}

/**
 * /llms-full.txt: everything of llms.txt plus the price method and the category tree in
 * all three languages. Stores are listed only when they are real (`stores` is empty while
 * the site runs on sample data), so invented shops never reach an AI answer.
 */
export function buildLlmsFullTxt(
  site: string,
  data: { categories: Category[]; stores: StoreSummary[] },
): string {
  const out: string[] = ["# Jeparla", "", `> ${en.About.lead}`, "", en.About.how, ""];
  const roots = data.categories.filter((c) => c.parentId === null);
  for (const [code, label, m] of LANGS) {
    out.push(`## ${label} (${code})`, "", m.About.lead, "", m.About.how, "");
    out.push(`### ${m.Nav.home}`, "", ...keyPages(site, code, m), "");
    out.push(`### ${m.About.faqTitle}`, "");
    for (const k of FAQ) out.push(`#### ${m.About.faq[k].q}`, "", m.About.faq[k].a, "");
    out.push(`### ${m.PricesPage.methodTitle}`, "");
    METHOD.forEach((k, i) => out.push(`${i + 1}. ${m.PricesPage.method[k]}`));
    out.push("", `${m.PricesPage.title}: ${site}/${code}/prices`, "");
    out.push(`### ${m.Categories.title}`, "");
    for (const root of roots) {
      out.push(`- [${root.name[code]}](${site}/${code}/categories/${root.slug})`);
      for (const c of data.categories.filter((x) => x.parentId === root.id))
        out.push(`  - [${c.name[code]}](${site}/${code}/categories/${c.slug})`);
    }
    out.push("");
    if (data.stores.length > 0) {
      out.push(`### ${m.Stores.title}`, "");
      for (const s of data.stores)
        out.push(`- [${s.name}, ${s.city}](${site}/${code}/stores/${s.slug})`);
      out.push("");
    }
  }
  out.push("## Optional", "", `- [Sitemap](${site}/sitemap.xml)`, "");
  return out.join("\n");
}
