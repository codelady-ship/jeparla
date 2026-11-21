// Primary navigation.
export const NAV_ITEMS = [
  { href: "/products", key: "catalog" },
  { href: "/stores", key: "stores" },
  { href: "/categories", key: "categories" },
] as const;

/**
 * "For buyers" and "For sellers": dropdown menus in the header and groups in the phone menu
 * (moved out of the footer at the owner's request, 2026-11-21). Labels are message keys.
 */
export const NAV_GROUPS = [
  {
    key: "buyers",
    links: [
      { href: "/guides", label: "Guides.navLabel" },
      { href: "/collections", label: "Collections.navLabel" },
      { href: "/products?kind=FASHION", label: "Catalog.fashionSection" },
      { href: "/prices", label: "Footer.metalPrices" },
      { href: "/verified", label: "Footer.howWeVerify" },
      { href: "/size-guide", label: "Footer.sizeGuide" },
      { href: "/calculator", label: "Footer.calculator" },
    ],
  },
  {
    key: "sellers",
    links: [
      { href: "/sell", label: "Footer.openStore" },
      { href: "/merchant", label: "Footer.merchantCabinet" },
    ],
  },
] as const;

export type NavGroup = { key: string; title: string; links: { href: string; label: string }[] };
