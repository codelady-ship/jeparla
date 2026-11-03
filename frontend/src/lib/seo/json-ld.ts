import { SITE_URL } from "@/i18n/alternates";
import type { Locale } from "@/i18n/routing";
import type { Product, Store } from "@/types/api";

/**
 * schema.org structured data (PLAN 5.18, issues #16 and #61). Search engines and AI
 * answer engines read these to understand what Jeparla, a store or a product is.
 * Only facts we actually have go in: no ratings, no review counts, no invented links.
 */
type Thing = Record<string, unknown>;

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

const AVAILABILITY: Record<Product["stockStatus"], string> = {
  IN_STOCK: "https://schema.org/InStock",
  MADE_TO_ORDER: "https://schema.org/PreOrder",
  OUT_OF_STOCK: "https://schema.org/OutOfStock",
};

const METAL_NAME: Record<Product["metal"], string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  PLATINUM: "Platinum",
  PALLADIUM: "Palladium",
};

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

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
        urlTemplate: `${SITE_URL}/${locale}/products?q={search_term_string}`,
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

/** Product with one Offer per variant. Prices are the exact decimal strings. */
export function product(p: Product, locale: Locale): Thing {
  const url = `${SITE_URL}/${locale}/products/${p.slug}`;
  const offers = p.variants.map((v) => ({
    "@type": "Offer",
    sku: v.sku,
    price: v.price.amount,
    priceCurrency: v.price.currency,
    availability: AVAILABILITY[v.stockStatus],
    // Metal-linked prices are recalculated every business day.
    ...(v.pricingMode === "METAL_LINKED" && { priceValidUntil: v.priceUpdatedAt.slice(0, 10) }),
    itemCondition: "https://schema.org/NewCondition",
    url,
    seller: { "@id": `${SITE_URL}/${locale}/stores/${p.store.slug}#store` },
  }));
  const first = p.variants[0];
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name[locale],
    description: p.description[locale],
    url,
    sku: first?.sku,
    image: p.images.map((i) => abs(i.url)),
    material: `${METAL_NAME[p.metal]} ${p.fineness}`,
    weight: { "@type": "QuantitativeValue", value: p.weightGrams, unitCode: "GRM" },
    additionalProperty: [
      { "@type": "PropertyValue", name: "fineness", value: p.fineness },
      { "@type": "PropertyValue", name: "metal", value: METAL_NAME[p.metal] },
      { "@type": "PropertyValue", name: "weight_grams", value: p.weightGrams },
    ],
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

export function jewelryStore(s: Store, locale: Locale): Thing {
  const url = `${SITE_URL}/${locale}/stores/${s.slug}`;
  return {
    "@type": "JewelryStore",
    "@id": `${url}#store`,
    name: s.name,
    description: s.description[locale],
    url,
    telephone: s.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: s.address,
      addressLocality: s.city,
      addressCountry: "AZ",
    },
    ...(s.geo && {
      geo: { "@type": "GeoCoordinates", latitude: s.geo.lat, longitude: s.geo.lng },
    }),
    openingHours: s.openingHours
      .split(/[;,]/)
      .map((r) => r.trim())
      .filter(Boolean),
    currenciesAccepted: "AZN",
    parentOrganization: { "@id": ORG_ID },
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
