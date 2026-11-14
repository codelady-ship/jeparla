import { SITE_URL } from "@/i18n/alternates";
import type { Locale } from "@/i18n/routing";
import { ORG_ID } from "./json-ld";

/**
 * schema.org for guide pages (PLAN 5.18, #63, #114): Article for the page itself and
 * HowTo for step-by-step instructions that are shown on the page word for word.
 */
type Thing = Record<string, unknown>;

export function article(a: {
  locale: Locale;
  path: string;
  headline: string;
  description: string;
  /** ISO date (YYYY-MM-DD). */
  published: string;
  modified: string;
}): Thing {
  const url = `${SITE_URL}/${a.locale}${a.path}`;
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: a.headline,
    description: a.description,
    inLanguage: a.locale,
    url,
    mainEntityOfPage: url,
    datePublished: a.published,
    dateModified: a.modified,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
}

export function howTo(h: {
  locale: Locale;
  path: string;
  /** Fragment of the section on the page that holds the steps. */
  anchor: string;
  name: string;
  description: string;
  supplies: string[];
  tools: string[];
  sections: { name: string; steps: string[] }[];
}): Thing {
  const url = `${SITE_URL}/${h.locale}${h.path}#${h.anchor}`;
  return {
    "@type": "HowTo",
    "@id": url,
    name: h.name,
    description: h.description,
    inLanguage: h.locale,
    url,
    supply: h.supplies.map((name) => ({ "@type": "HowToSupply", name })),
    tool: h.tools.map((name) => ({ "@type": "HowToTool", name })),
    step: h.sections.map((s) => ({
      "@type": "HowToSection",
      name: s.name,
      itemListElement: s.steps.map((text, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        text,
      })),
    })),
  };
}
