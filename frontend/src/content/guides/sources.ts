import type { GuideSlug, GuideSource } from "./types";

/**
 * Every source the guides cite. Each URL was opened and read on 2026-11-14 when the
 * guides were drafted; titles are given as the publisher wrote them.
 */
export const SOURCES = {
  cbarRates: {
    title: "AZN Məzənnələri",
    publisher: "Azərbaycan Respublikasının Mərkəzi Bankı (CBAR)",
    url: "https://www.cbar.az/currency/rates",
  },
  troyWeight: {
    title: "Troy weight",
    publisher: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Troy_weight",
  },
  fineness: {
    title: "Fineness",
    publisher: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Fineness",
  },
  giaQuality: {
    title: "Diamond Quality Factors",
    publisher: "GIA (Gemological Institute of America)",
    url: "https://www.gia.edu/diamond-quality-factor",
  },
  hallmarkingConvention: {
    title: "Benefits of the Convention",
    publisher: "Convention on the Control and Marking of Articles of Precious Metals",
    url: "https://hallmarkingconvention.org/en/about-benefits",
  },
  azertagAssay: {
    title:
      "Zərgərlik məmulatlarının satışı ilə məşğul olan sahibkarlara bu sahədəki məsuliyyət tədbirləri izah edilib",
    publisher: "AZƏRTAC, 2 iyul 2026",
    url: "https://azertag.az/xeber/zergerlik_memulatlarinin_satisi_ile_mesgul_olan_sahibkarlara_bu_sahedeki_mesuliyyet_tedbirleri_izah_edilib-4297439",
  },
  cciSilver: {
    title: "Silver – Care and Tarnish Removal – Canadian Conservation Institute (CCI) Notes 9/7",
    publisher: "Canadian Conservation Institute, Government of Canada",
    url: "https://www.canada.ca/en/conservation-institute/services/conservation-preservation-publications/canadian-conservation-institute-notes/care-silver.html",
  },
} as const satisfies Record<string, GuideSource>;

/** Sources per guide, in the order they are listed on the page. */
export const GUIDE_SOURCES: Record<GuideSlug, GuideSource[]> = {
  "585-vs-750-gold": [SOURCES.fineness, SOURCES.hallmarkingConvention],
  "gold-price-calculation": [SOURCES.cbarRates, SOURCES.troyWeight, SOURCES.fineness],
  "diamond-4c": [SOURCES.giaQuality],
  "hallmark-check": [SOURCES.hallmarkingConvention, SOURCES.azertagAssay, SOURCES.fineness],
  "silver-jewelry-care": [SOURCES.cciSilver, SOURCES.fineness],
};
