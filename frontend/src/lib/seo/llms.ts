import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";

const FAQ = ["what", "buy", "price", "verified", "sell"] as const;
const LANGS = [
  ["az", "Azərbaycanca", az],
  ["en", "English", en],
  ["ru", "Русский", ru],
] as const;

/**
 * /llms.txt content, built from the same messages the site shows, so AI assistants
 * read exactly what visitors read. No figures that are not on the site.
 */
export function buildLlmsTxt(site: string): string {
  const out: string[] = ["# Jeparla", "", `> ${en.About.lead}`, "", en.About.how, ""];
  for (const [code, label, m] of LANGS) {
    out.push(`## ${label} (${code})`, "");
    out.push(`- [${m.Nav.home}](${site}/${code}): ${m.Metadata.description}`);
    out.push(`- [${m.Catalog.title}](${site}/${code}/products): ${m.Catalog.description}`);
    out.push(`- [${m.Stores.title}](${site}/${code}/stores): ${m.Stores.description}`);
    out.push("");
    for (const k of FAQ) out.push(`### ${m.About.faq[k].q}`, "", m.About.faq[k].a, "");
  }
  out.push("## Optional", "", `- [Sitemap](${site}/sitemap.xml)`, "");
  return out.join("\n");
}
