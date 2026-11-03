import { describe, expect, it } from "vitest";
import robots, { AI_BOTS } from "@/app/robots";
import { PRODUCTS, STORES } from "@/lib/api/mock/fixtures";
import { formats } from "@/i18n/formats";
import { jewelryStore, organization, product, serializeJsonLd, website } from "./json-ld";
import { buildLlmsTxt } from "./llms";

describe("robots", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];

  it("explicitly allows AI answer engines and search bots", () => {
    const named = rules.flatMap((x) => (Array.isArray(x.userAgent) ? x.userAgent : [x.userAgent]));
    for (const bot of [...AI_BOTS, "Googlebot", "Bingbot"]) expect(named).toContain(bot);
    for (const rule of rules) expect(rule.allow).toBe("/");
  });

  it("keeps private areas closed for everyone and points to the sitemap", () => {
    for (const rule of rules) {
      expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/*/admin", "/*/merchant"]));
    }
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("JSON-LD", () => {
  const p = PRODUCTS[0];

  it("product offer price is the exact decimal string shown on the page", () => {
    const ld = product(p, "az") as { offers: { price: string; priceCurrency: string } };
    expect(ld.offers.price).toBe(p.variants[0].price.amount);
    expect(ld.offers.priceCurrency).toBe("AZN");
    // Same string the facts table formats, so both agree.
    expect(typeof ld.offers.price).toBe("string");
    expect(formats.number.price.currency).toBe(ld.offers.priceCurrency);
  });

  it("does not invent ratings or reviews", () => {
    const json = serializeJsonLd([product(p, "en"), jewelryStore(STORES[0], "en")]);
    expect(json).not.toMatch(/aggregateRating|review/i);
  });

  it("names the brand and offers site search", () => {
    const org = organization("x") as { name: string; logo: { url: string } };
    expect(org.name).toBe("Jeparla");
    expect(org.logo.url).toMatch(/\/logo\.png$/);
    const site = website("az", "x") as { potentialAction: { target: { urlTemplate: string } } };
    expect(site.potentialAction.target.urlTemplate).toContain(
      "/az/products?q={search_term_string}",
    );
  });

  it("escapes < so data cannot close the script tag", () => {
    expect(serializeJsonLd([{ name: "</script><x>" }])).not.toContain("</script>");
  });
});

describe("llms.txt", () => {
  it("describes Jeparla in all three languages with absolute links", () => {
    const txt = buildLlmsTxt("https://example.test");
    expect(txt.startsWith("# Jeparla\n")).toBe(true);
    for (const l of ["az", "en", "ru"]) expect(txt).toContain(`https://example.test/${l}/products`);
    expect(txt).toContain("https://example.test/sitemap.xml");
  });
});
