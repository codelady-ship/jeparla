import { SITE_URL } from "@/i18n/alternates";
import type { Locale } from "@/i18n/routing";
import type { Money, Product, Store } from "@/types/api";

/**
 * schema.org structured data (PLAN 5.18, issues #16 and #61). Search engines and AI
 * answer engines read these to understand what Jeparla, a store or a product is.
 * Only facts we actually have go in: no ratings, no review counts, no invented links,
 * and an empty field is left out rather than guessed.
 */
type Thing = Record<string, unknown>;

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

const AVAILABILITY: Record<Product["stockStatus"], string> = {
  IN_STOCK: "https://schema.org/InStock",
  MADE_TO_ORDER: "https://schema.org/PreOrder",
  OUT_OF_STOCK: "https://schema.org/OutOfStock",
};

const METAL_NAME: Record<NonNullable<Product["metal"]>, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  PLATINUM: "Platinum",
  PALLADIUM: "Palladium",
};

/** Bijouterie (#128) has a material instead of a metal and a fineness, and maybe no weight. */
const DIMENSION_NAME = {
  widthMm: "width",
  thicknessMm: "thickness",
  lengthMm: "length",
  diameterMm: "diameter",
} as const;

function materialFacts(p: Product) {
  const weight = p.weightGrams
    ? {
        weight: { "@type": "QuantitativeValue", value: p.weightGrams, unitCode: "GRM" },
      }
    : {};
  const weightProp = [
    ...(p.weightGrams
      ? [{ "@type": "PropertyValue", name: "weight_grams", value: p.weightGrams }]
      : []),
    // Sizes in mm (#174): only what the seller entered; MMT is the UN/CEFACT code for millimetre.
    ...(["widthMm", "thicknessMm", "lengthMm", "diameterMm"] as const).flatMap((k) => {
      const v = p.dimensions?.[k];
      return v
        ? [{ "@type": "PropertyValue", name: DIMENSION_NAME[k], value: v, unitCode: "MMT" }]
        : [];
    }),
  ];
  if (p.metal === null) {
    const material = (p.material ?? "OTHER").toLowerCase().replaceAll("_", " ");
    return {
      material,
      ...weight,
      additionalProperty: [
        { "@type": "PropertyValue", name: "material_kind", value: "fashion jewelry" },
        ...weightProp,
      ],
    };
  }
  return {
    material: `${METAL_NAME[p.metal]} ${p.fineness}`,
    ...weight,
    additionalProperty: [
      { "@type": "PropertyValue", name: "fineness", value: p.fineness },
      { "@type": "PropertyValue", name: "metal", value: METAL_NAME[p.metal] },
      ...weightProp,
    ],
  };
}

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);
const text = (v: string | null | undefined) => v?.trim() || undefined;

export function organization(description: string): Thing {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Jeparla",
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
    description,
    areaServed: { "@type": "Country", name: "Azerbaijan" },
  };
}

export function website(locale: Locale, description: string): Thing {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: "Jeparla",
    alternateName: "jeparla",
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    description,
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${locale}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbs(items: { name: string; path: string }[]): Thing {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

/** An ordered list of links: catalog and category results, search results, stores. */
export function itemList(name: string, items: { name: string; path: string }[]): Thing {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: abs(it.path),
    })),
  };
}

/** A price we can state: a positive decimal string with a currency. Anything else is no offer. */
export function isRealPrice(m: Money | null | undefined): m is Money {
  return !!m && !!m.currency && /^\d+(\.\d+)?$/.test(m.amount.trim()) && Number(m.amount) > 0;
}

/** The day after an ISO date: a metal-linked price holds until the next CBAR rate. */
export function nextDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Decimal strings compared without floats (prices have at most a few digits). */
const byAmount = (a: string, b: string) => {
  const [ai, af = ""] = a.split(".");
  const [bi, bf = ""] = b.split(".");
  if (ai.length !== bi.length) return ai.length - bi.length;
  const n = Math.max(af.length, bf.length);
  const x = ai + af.padEnd(n, "0");
  const y = bi + bf.padEnd(n, "0");
  return x < y ? -1 : x > y ? 1 : 0;
};

const storeRef = (s: { slug: string; name: string }, locale: Locale): Thing => ({
  "@type": "JewelryStore",
  "@id": `${SITE_URL}/${locale}/stores/${s.slug}#store`,
  name: s.name,
  url: `${SITE_URL}/${locale}/stores/${s.slug}`,
});

/**
 * Product. Offers only for variants with a real price: no offer is better than a made-up
 * one. Several priced variants become an AggregateOffer whose lowPrice is the "from" price
 * of the page's facts table. Prices stay the exact decimal strings from the API.
 */
export function product(p: Product, locale: Locale): Thing {
  const url = `${SITE_URL}/${locale}/products/${p.slug}`;
  const offers = p.variants
    .filter((v) => isRealPrice(v.price))
    .map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      price: v.price.amount,
      priceCurrency: v.price.currency,
      availability: AVAILABILITY[v.stockStatus],
      ...(v.pricingMode === "METAL_LINKED" && { priceValidUntil: nextDay(v.priceUpdatedAt) }),
      itemCondition: "https://schema.org/NewCondition",
      url,
      seller: storeRef(p.store, locale),
    }));
  const amounts = offers.map((o) => o.price).sort(byAmount);
  const first = p.variants[0];
  const description = text(p.description[locale]);
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name[locale],
    ...(description && { description }),
    url,
    ...(first && { sku: first.sku }),
    ...(p.images.length > 0 && { image: p.images.map((i) => abs(i.url)) }),
    ...materialFacts(p),
    ...(offers.length === 1 && { offers: offers[0] }),
    ...(offers.length > 1 && {
      offers: {
        "@type": "AggregateOffer",
        lowPrice: amounts[0],
        highPrice: amounts[amounts.length - 1],
        priceCurrency: offers[0].priceCurrency,
        offerCount: offers.length,
        offers,
      },
    }),
  };
}

/** The store's own facts only; a field the store has not filled is left out. */
export function jewelryStore(s: Store, locale: Locale): Thing {
  const url = `${SITE_URL}/${locale}/stores/${s.slug}`;
  const hours = s.openingHours
    .split(/[;,]/)
    .map((r) => r.trim())
    .filter(Boolean);
  const description = text(s.description[locale]);
  const street = text(s.address);
  const city = text(s.city);
  const phone = text(s.phone);
  return {
    "@type": "JewelryStore",
    "@id": `${url}#store`,
    name: s.name,
    ...(description && { description }),
    url,
    // The seller's registered identity (#249), only when the seller gave it.
    ...(s.seller && { legalName: s.seller.legalName }),
    ...(s.seller?.taxId && { taxID: s.seller.taxId }),
    ...(s.logoUrl && { image: abs(s.logoUrl), logo: abs(s.logoUrl) }),
    ...(phone && { telephone: phone }),
    ...((street || city) && {
      address: {
        "@type": "PostalAddress",
        ...(street && { streetAddress: street }),
        ...(city && { addressLocality: city }),
        addressCountry: "AZ",
      },
    }),
    ...(s.geo && {
      geo: { "@type": "GeoCoordinates", latitude: s.geo.lat, longitude: s.geo.lng },
    }),
    ...(hours.length > 0 && { openingHours: hours }),
    currenciesAccepted: "AZN",
    parentOrganization: { "@id": ORG_ID },
  };
}

/** A page with a known last change, e.g. the daily metal prices. */
export function webPage(input: {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  dateModified?: string;
}): Thing {
  const url = `${SITE_URL}/${input.locale}${input.path}`;
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    inLanguage: input.locale,
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
    ...(input.dateModified && { dateModified: input.dateModified }),
  };
}

export function faqPage(items: { q: string; a: string }[]): Thing {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

/** One @graph document; `<` is escaped so text can never close the script tag. */
export function serializeJsonLd(nodes: Thing[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(
    /</g,
    "\\u003c",
  );
}
