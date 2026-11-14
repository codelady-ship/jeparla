import { describe, expect, it } from "vitest";
import { az } from "@/content/guides/az";
import { en } from "@/content/guides/en";
import { ru } from "@/content/guides/ru";
import { GUIDE_SOURCES } from "@/content/guides/sources";
import { locales } from "@/i18n/routing";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import {
  GUIDE_SLUGS,
  GUIDES_MODIFIED,
  GUIDES_PUBLISHED,
  getGuide,
  guideArticle,
  guideList,
  isGuideSlug,
  listGuides,
} from ".";

const TEXTS = { az, en, ru };

/** Every string in a value, however deeply nested. */
function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("guides", () => {
  it("has the five guides of #63", () => {
    expect(GUIDE_SLUGS).toHaveLength(5);
    expect(isGuideSlug("diamond-4c")).toBe(true);
    expect(isGuideSlug("unknown")).toBe(false);
  });

  it.each(locales)("%s has exactly the same guides as the slug list", (l) => {
    expect(Object.keys(TEXTS[l]).sort()).toEqual([...GUIDE_SLUGS].sort());
  });

  it.each(GUIDE_SLUGS)("%s has the same section ids in every language", (slug) => {
    const ids = (l: (typeof locales)[number]) => TEXTS[l][slug].sections.map((s) => s.id);
    expect(ids("en")).toEqual(ids("az"));
    expect(ids("ru")).toEqual(ids("az"));
    expect(new Set(ids("az")).size).toBe(ids("az").length);
  });

  it.each(GUIDE_SLUGS)("%s cites at least one https source", (slug) => {
    expect(GUIDE_SOURCES[slug].length).toBeGreaterThan(0);
    for (const s of GUIDE_SOURCES[slug]) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.title.trim()).not.toBe("");
      expect(s.publisher.trim()).not.toBe("");
    }
  });

  it.each(locales)("%s: every guide has text and internal links point to real guides", (l) => {
    for (const g of listGuides(l)) {
      expect(g.title.trim()).not.toBe("");
      expect(g.description.trim()).not.toBe("");
      expect(g.answer.trim()).not.toBe("");
      expect(g.sections.length).toBeGreaterThan(0);
      for (const s of g.sections)
        for (const b of s.blocks)
          if (b.type === "links")
            for (const link of b.items) {
              if (link.href.startsWith("/guides/"))
                expect(isGuideSlug(link.href.slice("/guides/".length))).toBe(true);
              else expect(link.href).toMatch(/^(\/#|https:\/\/)/);
            }
    }
  });

  it.each(locales)("%s has no emoji and no empty strings", (l) => {
    for (const v of strings(TEXTS[l])) {
      expect(v.trim()).not.toBe("");
      expect(v).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
    }
  });

  it("builds an Article and an ItemList that parse as JSON-LD", () => {
    const g = getGuide("az", "gold-price-calculation");
    const json = JSON.parse(
      serializeJsonLd([
        guideArticle(g, "az", "Jeparla redaksiyası"),
        guideList(listGuides("az"), "az"),
      ]),
    );
    const [article, list] = json["@graph"];
    expect(json["@context"]).toBe("https://schema.org");
    expect(article["@type"]).toBe("Article");
    expect(article.headline).toBe(g.title);
    expect(article.inLanguage).toBe("az");
    expect(article.url).toMatch(/\/az\/guides\/gold-price-calculation$/);
    expect(article.datePublished).toBe(GUIDES_PUBLISHED);
    expect(article.dateModified).toBe(GUIDES_MODIFIED);
    expect(article.author).toEqual(
      expect.objectContaining({ "@type": "Organization", name: "Jeparla redaksiyası" }),
    );
    expect(article.citation).toHaveLength(g.sources.length);
    expect(list["@type"]).toBe("ItemList");
    expect(list.itemListElement).toHaveLength(GUIDE_SLUGS.length);
  });
});
