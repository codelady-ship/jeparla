import { describe, expect, it } from "vitest";
import robots, { AI_BOTS } from "@/app/robots";
import sitemap from "@/app/sitemap";
import { CATEGORIES, PRODUCTS, STORES } from "@/lib/api/mock/fixtures";
import {
  breadcrumbs,
  faqPage,
  isRealPrice,
  itemList,
  jewelryStore,
  nextDay,
  organization,
  product,
  serializeJsonLd,
  webPage,
  website,
} from "./json-ld";
import { buildLlmsFullTxt, buildLlmsTxt } from "./llms";
import { formatPrice } from "@/lib/money";
import { listGuides } from "@/lib/guides";

describe("robots", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];

  it("explicitly allows AI answer engines and search bots", () => {
    const named = rules.flatMap((x) => (Array.isArray(x.userAgent) ? x.userAgent : [x.userAgent]));
    for (const bot of [...AI_BOTS, "Googlebot", "Bingbot"]) expect(named).toContain(bot);
    for (const rule of rules) expect(rule.allow).toEqual(["/", "/api/og/"]);
  });

  it("keeps private areas closed for everyone and points to the sitemap", () => {
    for (const rule of rules) {
      expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/*/admin", "/*/merchant"]));
    }
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("names every AI crawler PLAN 5.18 lists (#61), none of them blocked", () => {
    const named = rules.flatMap((x) => (Array.isArray(x.userAgent) ? x.userAgent : [x.userAgent]));
    for (const bot of [
      "OAI-SearchBot",
      "ChatGPT-User",
      "GPTBot",
      "ClaudeBot",
      "Claude-SearchBot",
      "PerplexityBot",
      "Google-Extended",
      "Applebot-Extended",
      "Bingbot",
    ])
      expect(named).toContain(bot);
    for (const rule of rules) expect(rule.disallow).not.toContain("/");
  });

  it("closes the seller, admin and design areas and the API, but not the share images", () => {
    for (const rule of rules) {
      expect(rule.disallow).toEqual(
        expect.arrayContaining(["/api/", "/*/admin", "/*/merchant", "/*/design"]),
      );
      expect(rule.allow).toContain("/api/og/");
    }
    expect(r.sitemap).toMatch(/^https?:\/\/[^/]+\/sitemap\.xml$/);
  });
});

describe("facts table and JSON-LD agree on the price (#61)", () => {
  type Offer = { "@type": string; price: string; priceCurrency: string };
  type Agg = { "@type": string; lowPrice: string; priceCurrency: string };

  /** The amount a formatted price shows: every price has exactly two decimals. */
  const shownAmount = (text: string) => Number(text.replace(/\D/g, "")) / 100;

  it("the price in the facts table is the Offer price, in every language", () => {
    const priced = PRODUCTS.filter((p) => isRealPrice(p.priceFrom));
    expect(priced.length).toBeGreaterThan(0);
    for (const p of priced) {
      for (const locale of ["az", "en", "ru"] as const) {
        // product-details.tsx: facts.price row = formatPrice(p.priceFrom.amount, locale).
        const facts = formatPrice(p.priceFrom.amount, locale);
        const offers = (product(p, locale) as { offers: Offer | Agg }).offers;
        const offerPrice =
          offers["@type"] === "AggregateOffer" ? (offers as Agg).lowPrice : (offers as Offer).price;
        expect(shownAmount(facts)).toBe(Number(offerPrice));
        expect(offers.priceCurrency).toBe("AZN");
        expect(facts).toMatch(locale === "az" ? /₼$/ : /AZN/);
      }
    }
  });

  it("a product without a real price has neither a price row nor an offer", () => {
    for (const p of PRODUCTS.filter((x) => !isRealPrice(x.priceFrom))) {
      expect((product(p, "az") as { offers?: unknown }).offers).toBeUndefined();
    }
  });
});

describe("JSON-LD", () => {
  const p = PRODUCTS[0];

  it("bijouterie has its material, no metal or fineness, and no weight when there is none (#128)", () => {
    const fashion = {
      ...p,
      materialKind: "FASHION" as const,
      material: "STAINLESS_STEEL" as const,
      metal: null,
      fineness: null,
      weightGrams: null,
      variants: p.variants.map((v) => ({ ...v, fineness: null, weightGrams: null })),
    };
    const ld = product(fashion, "en") as Record<string, unknown>;
    expect(ld.material).toBe("stainless steel");
    expect(ld).not.toHaveProperty("weight");
    expect(JSON.stringify(ld.additionalProperty)).not.toMatch(/fineness|metal/);
  });

  it("product offer price is the exact decimal string shown on the page", () => {
    const ld = product(p, "az") as { offers: { price: string; priceCurrency: string } };
    expect(ld.offers.price).toBe(p.variants[0].price.amount);
    expect(ld.offers.priceCurrency).toBe("AZN");
    // Same string the facts table formats, so both agree.
    expect(typeof ld.offers.price).toBe("string");
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
    expect(site.potentialAction.target.urlTemplate).toContain("/az/search?q={search_term_string}");
  });

  it("escapes < so data cannot close the script tag", () => {
    expect(serializeJsonLd([{ name: "</script><x>" }])).not.toContain("</script>");
  });
});

describe("JSON-LD offers", () => {
  const base = PRODUCTS[0];
  const variant = base.variants[0];
  type Offer = {
    "@type": string;
    price: string;
    priceValidUntil?: string;
    seller: { name: string };
  };
  type Agg = {
    "@type": string;
    lowPrice: string;
    highPrice: string;
    offerCount: number;
    offers: Offer[];
  };

  it("agrees with the facts table price for every product (priceFrom)", () => {
    for (const p of PRODUCTS) {
      const offers = (product(p, "az") as { offers: Offer | Agg }).offers;
      const shown =
        offers["@type"] === "AggregateOffer" ? (offers as Agg).lowPrice : (offers as Offer).price;
      expect(shown).toBe(p.priceFrom.amount);
    }
  });

  it("several priced variants become an AggregateOffer with the exact low and high price", () => {
    const p = {
      ...base,
      variants: [
        { ...variant, id: 1, sku: "A", price: { amount: "1200.00", currency: "AZN" as const } },
        { ...variant, id: 2, sku: "B", price: { amount: "980.50", currency: "AZN" as const } },
        { ...variant, id: 3, sku: "C", price: { amount: "10450.00", currency: "AZN" as const } },
      ],
    };
    const agg = (product(p, "en") as { offers: Agg }).offers;
    expect(agg["@type"]).toBe("AggregateOffer");
    expect(agg.lowPrice).toBe("980.50");
    expect(agg.highPrice).toBe("10450.00");
    expect(agg.offerCount).toBe(3);
    expect(agg.offers[0].seller.name).toBe(base.store.name);
  });

  it("states no offer when there is no real price", () => {
    for (const amount of ["0", "0.00", "", "abc", "-5"]) {
      const p = {
        ...base,
        variants: [{ ...variant, price: { amount, currency: "AZN" as const } }],
      };
      expect(product(p, "az")).not.toHaveProperty("offers");
    }
    expect(isRealPrice({ amount: "508.75", currency: "AZN" })).toBe(true);
    expect(isRealPrice(null)).toBe(false);
  });

  it("a metal-linked price is valid until the next CBAR rate (the day after its update)", () => {
    const p = {
      ...base,
      variants: [
        {
          ...variant,
          pricingMode: "METAL_LINKED" as const,
          priceUpdatedAt: "2026-11-30T10:05:00+04:00",
        },
      ],
    };
    expect((product(p, "az") as { offers: Offer }).offers.priceValidUntil).toBe("2026-12-01");
    const fixed = { ...base, variants: [{ ...variant, pricingMode: "FIXED" as const }] };
    expect((product(fixed, "az") as { offers: Offer }).offers).not.toHaveProperty(
      "priceValidUntil",
    );
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
});

describe("JSON-LD store, lists and pages", () => {
  it("a store names the seller's registered identity only when the seller gave it (#249)", () => {
    const none = jewelryStore({ ...STORES[0], seller: undefined }, "az") as Record<string, unknown>;
    expect(none).not.toHaveProperty("legalName");
    expect(none).not.toHaveProperty("taxID");
    const named = jewelryStore(
      {
        ...STORES[0],
        seller: { legalName: "Nümunə MMC", legalType: "COMPANY", taxId: "1234567890" },
      },
      "az",
    ) as Record<string, unknown>;
    expect(named.legalName).toBe("Nümunə MMC");
    expect(named.taxID).toBe("1234567890");
  });

  it("a store carries only the fields it has", () => {
    const full = jewelryStore(STORES[0], "az") as Record<string, unknown>;
    expect(full.telephone).toBe(STORES[0].phone);
    expect(full.openingHours).toEqual(["Mo-Sa 10:00-20:00"]);
    const bare = jewelryStore(
      {
        ...STORES[0],
        phone: "",
        address: " ",
        city: "",
        openingHours: "",
        geo: null,
        logoUrl: null,
        description: { az: "", en: "", ru: "" },
      },
      "az",
    );
    for (const k of ["telephone", "address", "openingHours", "geo", "image", "description"])
      expect(bare).not.toHaveProperty(k);
    expect(bare).toMatchObject({ "@type": "JewelryStore", name: STORES[0].name });
  });

  it("ItemList numbers its items from 1 with absolute URLs", () => {
    const ld = itemList("Catalog", [
      { name: "A", path: "/az/products/a" },
      { name: "B", path: "/az/products/b" },
    ]) as { numberOfItems: number; itemListElement: { position: number; url: string }[] };
    expect(ld.numberOfItems).toBe(2);
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    for (const i of ld.itemListElement) expect(i.url).toMatch(/^https?:\/\/[^/]+\/az\/products\//);
  });

  it("BreadcrumbList items are absolute and ordered", () => {
    const ld = breadcrumbs([
      { name: "Stores", path: "/en/stores" },
      { name: "X", path: "/en/stores/x" },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(ld.itemListElement[1]).toMatchObject({ position: 2 });
    expect(ld.itemListElement[1].item).toMatch(/^https?:\/\/[^/]+\/en\/stores\/x$/);
  });

  it("a web page states its last change only when known", () => {
    const withDate = webPage({
      locale: "ru",
      path: "/prices",
      name: "n",
      description: "d",
      dateModified: "2026-11-10",
    });
    expect(withDate).toMatchObject({
      "@type": "WebPage",
      inLanguage: "ru",
      dateModified: "2026-11-10",
    });
    expect(
      webPage({ locale: "ru", path: "/prices", name: "n", description: "d" }),
    ).not.toHaveProperty("dateModified");
  });

  it("the whole graph serializes to valid JSON", () => {
    const json = serializeJsonLd([
      organization("x"),
      website("en", "x"),
      product(PRODUCTS[1], "en"),
      jewelryStore(STORES[1], "en"),
      itemList("l", []),
      faqPage([{ q: "q", a: "a" }]),
    ]);
    const parsed = JSON.parse(json) as { "@context": string; "@graph": unknown[] };
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"]).toHaveLength(6);
  });
});

describe("llms.txt", () => {
  it("describes Jeparla in all three languages with absolute links", () => {
    const txt = buildLlmsTxt("https://example.test");
    expect(txt.startsWith("# Jeparla\n")).toBe(true);
    for (const l of ["az", "en", "ru"]) {
      expect(txt).toContain(`https://example.test/${l}/products`);
      expect(txt).toContain(`https://example.test/${l}/prices`);
    }
    expect(txt).toContain("https://example.test/sitemap.xml");
    expect(txt).toContain("https://example.test/llms-full.txt");
  });

  it("lists every guide in every language; the full text adds each short answer (#63)", () => {
    const txt = buildLlmsTxt("https://example.test");
    const full = buildLlmsFullTxt("https://example.test", { categories: CATEGORIES, stores: [] });
    for (const l of ["az", "en", "ru"] as const) {
      expect(txt).toContain(`https://example.test/${l}/guides)`);
      for (const g of listGuides(l)) {
        expect(txt).toContain(`https://example.test/${l}/guides/${g.slug})`);
        expect(txt).not.toContain(g.answer);
        expect(full).toContain(`https://example.test/${l}/guides/${g.slug})`);
        expect(full).toContain(g.answer);
      }
    }
  });

  it("llms-full.txt adds the price method and categories, and lists only real stores", () => {
    const sample = buildLlmsFullTxt("https://example.test", { categories: CATEGORIES, stores: [] });
    for (const l of ["az", "en", "ru"]) {
      expect(sample).toContain(`https://example.test/${l}/categories/${CATEGORIES[0].slug}`);
    }
    expect(sample).toContain("31.1034768");
    expect(sample).not.toContain("/stores/");
    const live = buildLlmsFullTxt("https://example.test", {
      categories: CATEGORIES,
      stores: STORES,
    });
    expect(live).toContain(`https://example.test/en/stores/${STORES[0].slug}`);
  });

  it("links no private area: no seller cabinet, admin, design page or API (#61)", () => {
    const all =
      buildLlmsTxt("https://e.test") +
      buildLlmsFullTxt("https://e.test", { categories: CATEGORIES, stores: STORES });
    const links = all.match(/https:\/\/e\.test\/[^\s)>\]]*/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const path = link.slice("https://e.test".length);
      expect(path).not.toMatch(/^\/api\//);
      expect(path).not.toMatch(/^\/[a-z]{2}\/(merchant|admin|design|account)(\/|$)/);
    }
  });

  it("contains no emoji", () => {
    const all =
      buildLlmsTxt("https://e.test") +
      buildLlmsFullTxt("https://e.test", { categories: CATEGORIES, stores: STORES });
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("sitemap", () => {
  it("lists the prices page in every language with x-default", async () => {
    const entries = await sitemap();
    const prices = entries.find((e) => e.url.endsWith("/az/prices"));
    expect(prices?.alternates?.languages).toMatchObject({
      az: expect.stringMatching(/\/az\/prices$/),
      en: expect.stringMatching(/\/en\/prices$/),
      ru: expect.stringMatching(/\/ru\/prices$/),
      "x-default": expect.stringMatching(/\/az\/prices$/),
    });
  });
});
