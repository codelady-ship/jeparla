import { az } from "@/content/guides/az";
import { en } from "@/content/guides/en";
import { ru } from "@/content/guides/ru";
import { GUIDE_SOURCES } from "@/content/guides/sources";
import { GUIDE_SLUGS, type Guide, type GuideSlug, type GuideTexts } from "@/content/guides/types";
import { SITE_URL } from "@/i18n/alternates";
import type { Locale } from "@/i18n/routing";
import { ORG_ID } from "@/lib/seo/json-ld";

export { GUIDE_SLUGS, type Guide, type GuideSlug };

/** Content dates (ISO). Change GUIDES_MODIFIED whenever a guide's facts change. */
export const GUIDES_PUBLISHED = "2026-11-14";
export const GUIDES_MODIFIED = "2026-11-14";

export const GUIDES_PATH = "/guides";

const TEXTS: Record<Locale, GuideTexts> = { az, en, ru };

export function isGuideSlug(slug: string): slug is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(slug);
}

export function getGuide(locale: Locale, slug: GuideSlug): Guide {
  return { slug, ...TEXTS[locale][slug], sources: GUIDE_SOURCES[slug] };
}

export function listGuides(locale: Locale): Guide[] {
  return GUIDE_SLUGS.map((slug) => getGuide(locale, slug));
}

export const guidePath = (slug: GuideSlug) => `${GUIDES_PATH}/${slug}`;

/** True for links that leave the site (sources, the CBAR rates page). */
export const isExternal = (href: string) => /^https?:\/\//.test(href);

type Thing = Record<string, unknown>;

/**
 * schema.org Article for one guide. The author is the editorial team (an organization,
 * not an invented person); the publisher is Jeparla.
 */
export function guideArticle(g: Guide, locale: Locale, authorName: string): Thing {
  const url = `${SITE_URL}/${locale}${guidePath(g.slug)}`;
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: g.title,
    description: g.description,
    abstract: g.answer,
    inLanguage: locale,
    url,
    mainEntityOfPage: url,
    datePublished: GUIDES_PUBLISHED,
    dateModified: GUIDES_MODIFIED,
    author: { "@type": "Organization", name: authorName, url: `${SITE_URL}/${locale}` },
    publisher: { "@type": "Organization", "@id": ORG_ID, name: "Jeparla", url: `${SITE_URL}/` },
    citation: g.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
  };
}

/** schema.org ItemList of the guides, for the index page. */
export function guideList(guides: Guide[], locale: Locale): Thing {
  return {
    "@type": "ItemList",
    itemListElement: guides.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.title,
      url: `${SITE_URL}/${locale}${guidePath(g.slug)}`,
    })),
  };
}
