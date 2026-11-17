import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * SEO and GEO in the served HTML (issues #16, #61): every public page type has its title,
 * description, canonical, hreflang for az/en/ru plus x-default, Open Graph and Twitter tags,
 * and JSON-LD that parses and has the schema.org types of that page. Metadata does not
 * depend on the viewport, so this runs in the desktop project only.
 */
const SAMPLE_DATA = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

const PAGES: { path: string; canonical: string; types: string[] }[] = [
  { path: "/az", canonical: "/az", types: ["Organization", "WebSite", "FAQPage"] },
  { path: "/en/products", canonical: "/en/products", types: ["ItemList"] },
  {
    path: "/az/products/nisan-uzukleri-gold-585-1",
    canonical: "/az/products/nisan-uzukleri-gold-585-1",
    types: ["Product", "BreadcrumbList"],
  },
  { path: "/az/categories", canonical: "/az/categories", types: ["ItemList"] },
  {
    path: "/ru/categories/uzukler",
    canonical: "/ru/categories/uzukler",
    types: ["ItemList", "BreadcrumbList", "FAQPage"],
  },
  { path: "/az/stores", canonical: "/az/stores", types: ["ItemList"] },
  {
    path: "/az/stores/ayzer-zerger",
    canonical: "/az/stores/ayzer-zerger",
    types: ["JewelryStore", "BreadcrumbList"],
  },
  { path: "/az/search?q=qizil", canonical: "/az/search", types: ["ItemList"] },
  { path: "/en/prices", canonical: "/en/prices", types: ["WebPage", "BreadcrumbList"] },
];

async function jsonLdTypes(page: Page): Promise<string[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length, "at least one JSON-LD block").toBeGreaterThan(0);
  const types: string[] = [];
  for (const text of blocks) {
    // Throws (and fails the test) when a block is not valid JSON.
    const doc = JSON.parse(text) as { "@context": string; "@graph": { "@type": string }[] };
    expect(doc["@context"]).toBe("https://schema.org");
    for (const node of doc["@graph"]) types.push(node["@type"]);
    // Honesty rule: no ratings or reviews we do not have.
    expect(text).not.toMatch(/aggregateRating|"review"/i);
  }
  return types;
}

test.describe("SEO metadata and structured data", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, "metadata is viewport independent");

  for (const { path, canonical, types } of PAGES) {
    test(`${path}: canonical, hreflang, social tags and JSON-LD`, async ({ page }) => {
      const response = await page.goto(path);
      await expect(page).toHaveTitle(/\S/);
      const head = page.locator("head");
      await expect(head.locator('meta[name="description"]')).toHaveAttribute("content", /\S.{9,}/);

      const canonicalHref = await head.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonicalHref!).pathname).toBe(canonical);

      const rest = canonical.replace(/^\/(az|en|ru)/, "");
      for (const lang of ["az", "en", "ru", "x-default"]) {
        const href = await head
          .locator(`link[rel="alternate"][hreflang="${lang}"]`)
          .getAttribute("href");
        const expected = `/${lang === "x-default" ? "az" : lang}${rest}`;
        expect(new URL(href!).pathname, `hreflang ${lang}`).toBe(expected);
      }

      await expect(head.locator('meta[property="og:title"]')).toHaveAttribute("content", /\S/);
      await expect(head.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        new RegExp(`${canonical}$`),
      );
      await expect(head.locator('meta[property="og:image"]').first()).toHaveAttribute(
        "content",
        /^https?:\/\//,
      );
      await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute("content", /\S/);

      const found = await jsonLdTypes(page);
      for (const type of types) expect(found, `JSON-LD @type ${type}`).toContain(type);

      if (SAMPLE_DATA) {
        // Sample data is invented: no page built from it may be indexed (one response
        // header for every page, see next.config.ts).
        expect(response?.headers()["x-robots-tag"]).toMatch(/noindex/);
      }
    });
  }

  test("the product facts table shows the same price as the JSON-LD offer", async ({ page }) => {
    await page.goto("/en/products/nisan-uzukleri-gold-585-1");
    const text = await page.locator('script[type="application/ld+json"]').first().textContent();
    const graph = (JSON.parse(text!) as { "@graph": Record<string, unknown>[] })["@graph"];
    const product = graph.find((n) => n["@type"] === "Product") as {
      offers: { price?: string; lowPrice?: string };
    };
    const amount = product.offers.lowPrice ?? product.offers.price!;
    const [int, frac] = amount.split(".");
    // en format: 1,248.50
    const shown = `${Number(int).toLocaleString("en-US")}.${frac}`;
    const row = page
      .locator('section[aria-labelledby="facts"] tr')
      .filter({ has: page.locator("th", { hasText: /^Price$/ }) });
    await expect(row).toContainText(shown);
  });

  test("robots.txt, sitemap.xml, llms.txt and llms-full.txt are served", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Bingbot"])
      expect(robots).toContain(bot);
    expect(robots).toMatch(/Disallow: \/\*\/admin/);
    expect(robots).toMatch(/Sitemap: \S+\/sitemap\.xml/);

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain('hreflang="x-default"');
    for (const lang of ["az", "en", "ru"]) expect(sitemap).toContain(`/${lang}/prices`);

    const llms = await request.get("/llms.txt");
    expect(llms.headers()["content-type"]).toContain("text/plain");
    expect(await llms.text()).toMatch(/^# Jeparla\n/);

    const full = await (await request.get("/llms-full.txt")).text();
    expect(full).toContain("31.1034768");
    if (SAMPLE_DATA) expect(full).not.toContain("/stores/");
  });
});
