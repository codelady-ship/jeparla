/**
 * Demo data for building the frontend before the backend exists (issue #6).
 * Everything here is invented: store names, addresses, phone numbers (+994 50 000 00 0X)
 * and metal prices are not real and must never be shown as real data in production.
 * Generated deterministically (no Math.random, no Date.now) so builds are reproducible.
 */
import Big from "big.js";
import { gramPrice, metalLinkedBreakdown, type PriceBreakdown } from "@/lib/pricing";
import type {
  Category,
  ExchangeRate,
  Fineness,
  LocalizedText,
  MetalPrice,
  MetalType,
  Money,
  OccasionCollection,
  PricingMode,
  PricingRule,
  Product,
  ProductImage,
  Stone,
  Store,
  VariantPriceBreakdown,
  Verification,
} from "@/types/api";

const VERIFIED: Verification = { seller: "VERIFIED", documents: "VERIFIED", expertise: "NONE" };
const SELLER_ONLY: Verification = { seller: "VERIFIED", documents: "PENDING", expertise: "NONE" };
const NEW_STORE: Verification = { seller: "PENDING", documents: "NONE", expertise: "NONE" };

// ---------------------------------------------------------------- finenesses
/**
 * The reference finenesses of backend migration V61, in the API order (sort_order). Ids 1..6 are
 * the ones the demo products use; 7..10 came with V61.
 */
export const FINENESSES: Fineness[] = [
  { id: 1, metal: "GOLD", value: 375, label: "375 (9K)" },
  { id: 7, metal: "GOLD", value: 583, label: "583 (14K)" },
  { id: 2, metal: "GOLD", value: 585, label: "585 (14K)" },
  { id: 3, metal: "GOLD", value: 750, label: "750 (18K)" },
  { id: 8, metal: "GOLD", value: 916, label: "916 (22K)" },
  { id: 4, metal: "GOLD", value: 999, label: "999 (24K)" },
  { id: 9, metal: "SILVER", value: 875, label: "875" },
  { id: 5, metal: "SILVER", value: 925, label: "925" },
  { id: 10, metal: "SILVER", value: 999, label: "999" },
  { id: 6, metal: "PLATINUM", value: 950, label: "950" },
];

const finenessById = (id: number): Fineness => FINENESSES.find((f) => f.id === id)!;

// ---------------------------------------------------------------- metal prices
/** Demo CBAR-style quotes, AZN per troy ounce, for the last business day. */
const OUNCE_BASE: Record<MetalType, string> = {
  GOLD: "7000.00",
  SILVER: "85.00",
  PLATINUM: "2900.00",
  PALLADIUM: "2500.00",
};
export const PRICE_DATE = "2026-11-03";

function businessDays(end: string, count: number): string[] {
  const days: string[] = [];
  const d = new Date(`${end}T00:00:00Z`);
  while (days.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days;
}

/** 30 business days of history with a small deterministic wave (+-1.5%). */
export const METAL_PRICE_HISTORY: MetalPrice[] = (Object.keys(OUNCE_BASE) as MetalType[]).flatMap(
  (metal) =>
    businessDays(PRICE_DATE, 30).map((date, i, all) => {
      const daysBack = all.length - 1 - i;
      const factor = new Big(1).plus(new Big(Math.round(Math.sin(daysBack / 3) * 150)).div(10000));
      const ounce = new Big(OUNCE_BASE[metal]).times(factor).round(2).toFixed(2);
      return {
        metal,
        date,
        pricePerOunce: ounce,
        pricePerGram: gramPrice(ounce),
        currency: "AZN" as const,
        source: "CBAR" as const,
        fetchedAt: `${date}T10:05:00+04:00`,
      };
    }),
);

export const LATEST_METAL_PRICES: MetalPrice[] = METAL_PRICE_HISTORY.filter(
  (p) => p.date === PRICE_DATE,
);

/** Demo USD/EUR rates (#53): the CBAR bulletin values of 06.11.2026 in the backend test fixture. */
export const EXCHANGE_RATES: ExchangeRate[] = [
  {
    currency: "USD",
    date: PRICE_DATE,
    aznPerUnit: "1.700000",
    fetchedAt: `${PRICE_DATE}T10:05:00+04:00`,
  },
  {
    currency: "EUR",
    date: PRICE_DATE,
    aznPerUnit: "1.903700",
    fetchedAt: `${PRICE_DATE}T10:05:00+04:00`,
  },
];

const pureGram = (metal: MetalType) =>
  LATEST_METAL_PRICES.find((p) => p.metal === metal)!.pricePerGram;

// ---------------------------------------------------------------- stores
const store = (
  id: number,
  slug: string,
  name: string,
  city: string,
  verification: Verification,
  description: LocalizedText,
): Store => ({
  id,
  slug,
  name,
  city,
  logoUrl: null,
  verification,
  productCount: 0,
  description,
  address: `${city}, nümunə küçəsi ${id}`,
  whatsapp: `+99450000000${id}`,
  phone: `+99450000000${id}`,
  openingHours: "Mo-Sa 10:00-20:00",
  geo: null,
  createdAt: "2026-09-01T09:00:00+04:00",
});

export const STORES: Store[] = [
  store(1, "ayzer-zerger", "Ayzər Zərgər", "Bakı", VERIFIED, {
    az: "Klassik qızıl və nişan üzükləri.",
    en: "Classic gold and engagement rings.",
    ru: "Классическое золото и помолвочные кольца.",
  }),
  store(2, "lale-atelye", "Lalə Atelye", "Bakı", VERIFIED, {
    az: "Əl işi gümüş və minimal dizayn.",
    en: "Handmade silver and minimal design.",
    ru: "Серебро ручной работы и минималистичный дизайн.",
  }),
  store(3, "nergiz-gold", "Nərgiz Gold", "Gəncə", SELLER_ONLY, {
    az: "Gündəlik qızıl zərgərlik.",
    en: "Everyday gold jewelry.",
    ru: "Золотые украшения на каждый день.",
  }),
  store(4, "xezer-inci", "Xəzər İnci", "Sumqayıt", VERIFIED, {
    az: "İnci və rəngli daşlar.",
    en: "Pearls and coloured stones.",
    ru: "Жемчуг и цветные камни.",
  }),
  store(5, "semender-zerger", "Səməndər Zərgər", "Bakı", SELLER_ONLY, {
    az: "Brilyantlı dəstlər.",
    en: "Diamond sets.",
    ru: "Комплекты с бриллиантами.",
  }),
  store(6, "yeni-ulduz", "Yeni Ulduz", "Lənkəran", NEW_STORE, {
    az: "Yeni açılmış mağaza.",
    en: "Newly opened store.",
    ru: "Недавно открытый магазин.",
  }),
];

// ---------------------------------------------------------------- categories
type CatSeed = [
  id: number,
  slug: string,
  parent: number | null,
  az: string,
  en: string,
  ru: string,
];
const CAT_SEEDS: CatSeed[] = [
  [1, "uzukler", null, "Üzüklər", "Rings", "Кольца"],
  [2, "nisan-uzukleri", 1, "Nişan üzükləri", "Engagement rings", "Помолвочные кольца"],
  [3, "toy-uzukleri", 1, "Toy üzükləri", "Wedding rings", "Обручальные кольца"],
  [4, "sirgalar", null, "Sırğalar", "Earrings", "Серьги"],
  [5, "boyunbagilar", null, "Boyunbağılar", "Necklaces", "Колье"],
  [6, "zencirler", 5, "Zəncirlər", "Chains", "Цепочки"],
  [7, "asqilar", 5, "Asqılar", "Pendants", "Подвески"],
  [8, "qolbaqlar", null, "Qolbaqlar", "Bracelets", "Браслеты"],
  [9, "destler", null, "Dəstlər", "Sets", "Комплекты"],
  [10, "broslar", null, "Broşlar", "Brooches", "Броши"],
  [11, "kisi-zergerliyi", null, "Kişi zərgərliyi", "Men's jewelry", "Мужские украшения"],
  [12, "usaq-zergerliyi", null, "Uşaq zərgərliyi", "Kids' jewelry", "Детские украшения"],
];

/** Singular product nouns per leaf category. */
const NOUN: Record<number, LocalizedText> = {
  2: { az: "nişan üzüyü", en: "engagement ring", ru: "помолвочное кольцо" },
  3: { az: "toy üzüyü", en: "wedding ring", ru: "обручальное кольцо" },
  4: { az: "sırğa", en: "earrings", ru: "серьги" },
  6: { az: "zəncir", en: "chain", ru: "цепочка" },
  7: { az: "asqı", en: "pendant", ru: "подвеска" },
  8: { az: "qolbaq", en: "bracelet", ru: "браслет" },
  9: { az: "dəst", en: "set", ru: "комплект" },
  10: { az: "broş", en: "brooch", ru: "брошь" },
  11: { az: "kişi üzüyü", en: "men's ring", ru: "мужское кольцо" },
  12: { az: "uşaq sırğası", en: "kids' earrings", ru: "детские серьги" },
};
const LEAVES = Object.keys(NOUN).map(Number);

const METAL_WORD: Record<MetalType, LocalizedText> = {
  GOLD: { az: "qızıl", en: "gold", ru: "из золота" },
  SILVER: { az: "gümüş", en: "silver", ru: "из серебра" },
  PLATINUM: { az: "platin", en: "platinum", ru: "из платины" },
  PALLADIUM: { az: "palladium", en: "palladium", ru: "из палладия" },
};

const COLLECTIONS: LocalizedText[] = [
  { az: "Leyla", en: "Leyla", ru: "Лейла" },
  { az: "Nur", en: "Nur", ru: "Нур" },
  { az: "Səma", en: "Sama", ru: "Сама" },
  { az: "Xəzər", en: "Khazar", ru: "Хазар" },
  { az: "Ay işığı", en: "Moonlight", ru: "Лунный свет" },
];

// ---------------------------------------------------------------- products
const RULE: PricingRule = {
  laborPerGram: "12.00",
  laborFixed: "20.00",
  stonePrice: "0.00",
  markupPercent: "15.00",
  minPrice: null,
  maxPrice: null,
};

function metalFor(i: number): { metal: MetalType; fineness: Fineness } {
  if (i % 20 === 7) return { metal: "PLATINUM", fineness: finenessById(6) };
  if (i % 4 === 1) return { metal: "SILVER", fineness: finenessById(5) };
  const gold = [2, 3, 2, 1, 4].map(finenessById);
  return { metal: "GOLD", fineness: gold[i % gold.length] };
}

function diamond(i: number): Stone {
  return {
    type: "DIAMOND",
    origin: i % 3 === 0 ? "LAB_GROWN" : "NATURAL",
    shape: ["ROUND", "OVAL", "PRINCESS"][i % 3],
    carat: ["0.10", "0.25", "0.50"][i % 3],
    color: ["D", "F", "G"][i % 3],
    clarity: ["VS1", "VVS2", "SI1"][i % 3],
    cut: "EXCELLENT",
    count: 1,
    certificateLab: i % 2 === 0 ? "GIA" : null,
    certificateNumber: null,
  };
}

// ---------------------------------------------------------------- demo photos
/**
 * Free Unsplash photos (public/demo, authors in docs/credits.md) so the demo catalog looks
 * like jewelry. Real photos, not AI, and not of these products: the description says so.
 */
type Kind = "ring" | "earrings" | "necklace" | "bracelet";
const DEMO_PHOTOS: Record<Kind, { gold: string[]; silver: string[] }> = {
  ring: { gold: ["ring-gold-1"], silver: ["ring-silver-1", "ring-silver-3"] },
  earrings: {
    gold: ["earrings-gold-1", "earrings-gold-2", "earrings-gold-3"],
    silver: ["earrings-silver-1"],
  },
  necklace: {
    gold: ["necklace-gold-1", "necklace-gold-2", "necklace-gold-3"],
    silver: ["necklace-silver-1", "necklace-silver-2", "necklace-silver-3"],
  },
  bracelet: { gold: ["bracelet-gold-2", "bracelet-gold-3"], silver: ["bracelet-silver-1"] },
};
/** Leaf category -> photo kind (brooches and sets borrow necklaces, kids' jewelry earrings). */
const KIND_OF: Record<number, Kind> = {
  2: "ring",
  3: "ring",
  4: "earrings",
  6: "necklace",
  7: "necklace",
  8: "bracelet",
  9: "necklace",
  10: "necklace",
  11: "ring",
  12: "earrings",
};

function demoPhotos(i: number, categoryId: number, metal: MetalType, alt: LocalizedText) {
  const pool = DEMO_PHOTOS[KIND_OF[categoryId] ?? "necklace"][metal === "GOLD" ? "gold" : "silver"];
  const pick = (n: number) => ({
    url: `/demo/${pool[n % pool.length]}.jpg`,
    alt,
    width: 800,
    height: 1000,
    aiGenerated: false,
  });
  // Every third product has a second shot (when the pool has one), so both card states are covered.
  return i % 3 === 0 && pool.length > 1 ? [pick(i), pick(i + 1)] : [pick(i)];
}

const azn = (amount: string): Money => ({ amount, currency: "AZN" });
/** A rule input the seller left at 0 is null in the breakdown, never a "0.00" line. */
const positive = (amount: string): Money | null => (new Big(amount).gt(0) ? azn(amount) : null);

/**
 * `Variant.priceBreakdown` (#104) exactly as the backend PriceBreakdownDto builds it on the demo seed
 * (the contract test compares them): METAL_LINKED parts from the same metalLinkedBreakdown as the price,
 * at the demo CBAR quote; FIXED has the total and the price per gram only, never an invented split. No
 * demo store shows labor and markup as two lines (the V45 default).
 */
function demoPriceBreakdown(input: {
  amount: string;
  weight: string;
  fineness: Fineness;
  metal: MetalType;
  rule: PricingRule;
  pricingMode: PricingMode;
  parts: PriceBreakdown;
}): VariantPriceBreakdown {
  const { amount, weight, fineness, metal, rule, pricingMode, parts } = input;
  const total = azn(amount);
  const pricePerGram = azn(new Big(amount).div(weight).round(2, Big.roundHalfUp).toFixed(2));
  if (pricingMode !== "METAL_LINKED")
    return {
      total,
      metal: null,
      labor: null,
      stone: null,
      markup: null,
      clamped: null,
      pricePerGram,
      laborSeparate: false,
    };
  const anyLabor = new Big(rule.laborPerGram).gt(0) || new Big(rule.laborFixed).gt(0);
  return {
    total,
    metal: {
      value: azn(parts.metal),
      weightGrams: weight,
      fineness: fineness.value,
      gramPrice: azn(pureGram(metal)),
      quoteDate: PRICE_DATE,
      source: "CBAR",
    },
    labor: anyLabor
      ? {
          amount: azn(parts.labor),
          perGram: positive(rule.laborPerGram),
          fixed: positive(rule.laborFixed),
        }
      : null,
    stone: positive(rule.stonePrice),
    markup: new Big(rule.markupPercent).gt(0)
      ? { percent: rule.markupPercent, amount: azn(parts.markup) }
      : null,
    clamped: parts.clamped,
    pricePerGram,
    laborSeparate: false,
  };
}

function buildProduct(i: number): Product {
  const id = i + 1;
  const categoryId = LEAVES[i % LEAVES.length];
  const st = STORES[i % STORES.length];
  const { metal, fineness } = metalFor(i);
  const weight = new Big(1.2).plus(new Big((i * 37) % 90).div(10)).toFixed(3);
  const withStone = metal !== "SILVER" && (categoryId === 2 || categoryId === 9 || i % 6 === 0);
  const stones = withStone ? [diamond(i)] : [];
  const rule: PricingRule = {
    ...RULE,
    stonePrice: withStone ? ["250.00", "650.00", "1400.00"][i % 3] : "0.00",
  };
  const pricingMode: PricingMode = i % 3 === 2 ? "FIXED" : "METAL_LINKED";
  const parts = metalLinkedBreakdown({
    weightGrams: weight,
    fineness: fineness.value,
    pureGramPrice: pureGram(metal),
    rule,
  });
  const linked = parts.total;
  // FIXED prices are what the seller typed: the linked value rounded to tens.
  const amount =
    pricingMode === "FIXED" ? new Big(linked).div(10).round(0).times(10).toFixed(2) : linked;
  const col = COLLECTIONS[i % COLLECTIONS.length];
  const noun = NOUN[categoryId];
  const mw = METAL_WORD[metal];
  const name: LocalizedText = {
    az: `${col.az} — ${mw.az} ${noun.az} ${fineness.value}`,
    en: `${col.en} — ${mw.en} ${noun.en} ${fineness.value}`,
    ru: `${col.ru} — ${noun.ru} ${mw.ru} ${fineness.value}`,
  };
  const slug = `${CAT_SEEDS[categoryId - 1][1]}-${metal.toLowerCase()}-${fineness.value}-${id}`;
  const verification: Verification = {
    ...st.verification,
    documents: i % 4 === 3 ? "PENDING" : st.verification.documents,
  };
  const stockStatus = i % 11 === 10 ? "OUT_OF_STOCK" : i % 7 === 6 ? "MADE_TO_ORDER" : "IN_STOCK";
  const publishedAt = new Date(Date.UTC(2026, 9, 1 + (i % 30), 9)).toISOString();

  return {
    id,
    slug,
    name,
    categoryId,
    store: {
      id: st.id,
      slug: st.slug,
      name: st.name,
      city: st.city,
      verification: st.verification,
    },
    materialKind: "PRECIOUS",
    material: null,
    metal,
    priceFrom: { amount, currency: "AZN" },
    defaultVariantId: id * 10,
    pricingMode,
    fineness: fineness.value,
    weightGrams: weight,
    images: demoPhotos(i, categoryId, metal, name),
    hasStones: withStone,
    verification,
    stockStatus,
    publishedAt,
    description: {
      az: `${name.az}. Nümunə məhsul, real deyil.`,
      en: `${name.en}. Demo product, not real.`,
      ru: `${name.ru}. Демонстрационный товар, не настоящий.`,
    },
    variants: [
      {
        id: id * 10,
        sku: `JP-${String(id).padStart(4, "0")}`,
        fineness,
        weightGrams: weight,
        size: categoryId === 2 || categoryId === 3 || categoryId === 11 ? "17" : null,
        price: { amount, currency: "AZN" },
        pricingMode,
        pricing: pricingMode === "METAL_LINKED" ? rule : null,
        stockStatus,
        priceUpdatedAt: `${PRICE_DATE}T10:05:00+04:00`,
        priceBreakdown: demoPriceBreakdown({
          amount,
          weight,
          fineness,
          metal,
          rule,
          pricingMode,
          parts,
        }),
      },
    ],
    stones,
    status: "APPROVED",
  };
}

/**
 * Product 60 (index 59) is bijouterie (#128), so the FASHION card, product page and filter have sample
 * data: a stainless steel bracelet of store 6 (no documents, so the store may be MIXED; the seed sets
 * seller_kind there). It keeps the store, weight, stock and date rules of index 59, so every count of the
 * catalog stays the same; only its category moves to bracelets. FIXED price, no metal, no fineness, no
 * metal price block. Mirrored in backend/src/main/resources/db/demo/R__demo_seed.sql.
 */
const FASHION_INDEX = 59;
const FASHION_PRICE = "45.00";

function fashionProduct(i: number): Product {
  const id = i + 1;
  const categoryId = 8;
  const st = STORES[i % STORES.length];
  const weight = new Big(1.2).plus(new Big((i * 37) % 90).div(10)).toFixed(3);
  const stockStatus = i % 11 === 10 ? "OUT_OF_STOCK" : i % 7 === 6 ? "MADE_TO_ORDER" : "IN_STOCK";
  const publishedAt = new Date(Date.UTC(2026, 9, 1 + (i % 30), 9)).toISOString();
  const name: LocalizedText = {
    az: "Paslanmaz polad qolbaq",
    en: "Stainless steel bracelet",
    ru: "Браслет из нержавеющей стали",
  };
  const price = azn(FASHION_PRICE);
  return {
    id,
    slug: `${CAT_SEEDS[categoryId - 1][1]}-polad-${id}`,
    name,
    categoryId,
    store: {
      id: st.id,
      slug: st.slug,
      name: st.name,
      city: st.city,
      verification: st.verification,
    },
    materialKind: "FASHION",
    material: "STAINLESS_STEEL",
    metal: null,
    priceFrom: price,
    defaultVariantId: id * 10,
    pricingMode: "FIXED",
    fineness: null,
    weightGrams: weight,
    images: [
      {
        url: "/demo/bracelet-silver-1.jpg",
        alt: name,
        width: 800,
        height: 1000,
        aiGenerated: false,
      },
    ],
    hasStones: false,
    // Bijouterie shows only the seller check (#128), as the API's CatalogMapper.verification.
    verification: { ...st.verification, documents: "NONE", expertise: "NONE" },
    stockStatus,
    publishedAt,
    description: {
      az: `${name.az}. Nümunə məhsul, real deyil.`,
      en: `${name.en}. Demo product, not real.`,
      ru: `${name.ru}. Демонстрационный товар, не настоящий.`,
    },
    variants: [
      {
        id: id * 10,
        sku: `JP-${String(id).padStart(4, "0")}`,
        fineness: null,
        weightGrams: weight,
        size: null,
        price,
        pricingMode: "FIXED",
        pricing: null,
        stockStatus,
        priceUpdatedAt: `${PRICE_DATE}T10:05:00+04:00`,
        priceBreakdown: {
          total: price,
          metal: null,
          labor: null,
          stone: null,
          markup: null,
          clamped: null,
          pricePerGram: azn(
            new Big(FASHION_PRICE).div(weight).round(2, Big.roundHalfUp).toFixed(2),
          ),
          laborSeparate: false,
        },
      },
    ],
    stones: [],
    status: "APPROVED",
  };
}

export const PRODUCTS: Product[] = Array.from({ length: 60 }, (_, i) =>
  i === FASHION_INDEX ? fashionProduct(i) : buildProduct(i),
);

/**
 * Product 13 (gold 585 earrings of store 1) has a hallmark photo an admin checked and a label photo
 * still waiting for the check (#106), so the gallery frames, the "hallmark photo" filter and the admin
 * queue have sample data. The pictures are drawn for the demo (docs/credits.md), not photos of a real
 * hallmark. Mirrored in R__demo_seed.sql (product_evidence_photos); the API lists HALLMARK first.
 */
export const EVIDENCE_PRODUCT_ID = 13;
Object.assign(PRODUCTS[EVIDENCE_PRODUCT_ID - 1], {
  evidencePhotos: [
    {
      kind: "HALLMARK",
      url: "/demo/hallmark-gold-585.jpg",
      width: 800,
      height: 800,
      checked: true,
    },
    { kind: "TAG", url: "/demo/tag-gold-585.jpg", width: 800, height: 800, checked: false },
  ],
} satisfies Partial<Product>);

for (const s of STORES) s.productCount = PRODUCTS.filter((p) => p.store.id === s.id).length;

// One demo store declares its own terms (#108, #174); the others have declared none.
Object.assign(STORES[0], {
  services: ["RESIZE", "RETURNS"],
  returnPolicy: "14 gün ərzində, çek və qablaşdırma ilə dəyişdirmə.",
  madeToOrder: { offered: true, days: 10 },
} satisfies Partial<Store>);

export const CATEGORIES: Category[] = CAT_SEEDS.map(([id, slug, parentId, az, en, ru]) => ({
  id,
  slug,
  parentId,
  name: { az, en, ru },
  productCount: PRODUCTS.filter((p) => p.categoryId === id || CAT_SEEDS[p.categoryId - 1][2] === id)
    .length,
}));

// ---------------------------------------------------------------- occasion collections (#115)
/** The first six (owner, 2026-11-18), as V63 creates them: ids 1..6 in this order. */
const OCCASION_SEEDS: [slug: string, az: string, en: string, ru: string][] = [
  ["nisan", "Nişan", "Engagement", "Помолвка"],
  ["toy", "Toy", "Wedding", "Свадьба"],
  ["hediyye", "Hədiyyə", "Gift", "Подарок"],
  ["gundelik", "Gündəlik", "Everyday", "На каждый день"],
  ["kisi-ucun", "Kişi üçün", "For him", "Для него"],
  ["usaq-ucun", "Uşaq üçün", "For kids", "Для детей"],
];

/**
 * The seller's occasion tags of a demo product (index i, leaf category c), the same rule as
 * the demo seed (backend/src/main/resources/db/demo/R__demo_seed.sql).
 */
function occasionsOf(i: number, c: number): string[] {
  const out: string[] = [];
  if (c === 2) out.push("nisan");
  if (c === 3 || c === 9) out.push("toy");
  if ([4, 7, 8, 9, 10].includes(c) && i % 3 !== 1) out.push("hediyye");
  if ([4, 6, 8].includes(c) && i % 3 !== 0) out.push("gundelik");
  if (c === 11) out.push("kisi-ucun");
  if (c === 12) out.push("usaq-ucun");
  return out;
}

/** Product id -> occasion collection slugs. */
export const PRODUCT_OCCASIONS: ReadonlyMap<number, readonly string[]> = new Map(
  PRODUCTS.map((p, i) => [p.id, occasionsOf(i, p.categoryId)]),
);

/** How many of a collection's newest products are looked at for its cover (as the backend). */
const COVER_CANDIDATES = 12;

const photoFile = (url: string) => url.split("#")[0];

/**
 * Collections with counts and covers, the rule of backend CollectionService.shown(): the main
 * photo of one of the 12 newest listed products, never an AI image, preferring a photo file no
 * earlier collection uses yet. Real product photos only, no stock pictures.
 */
function withCovers(): OccasionCollection[] {
  const used = new Set<string>();
  return OCCASION_SEEDS.map(([slug, az, en, ru], i) => {
    const listed = PRODUCTS.filter(
      (p) => p.status === "APPROVED" && PRODUCT_OCCASIONS.get(p.id)?.includes(slug),
    );
    const newest = [...listed]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id)
      .slice(0, COVER_CANDIDATES);
    const real = (img: ProductImage | undefined): img is ProductImage => !!img && !img.aiGenerated;
    const main = newest.map((p) => p.images[0]).filter(real);
    const fresh = (img: ProductImage) => !used.has(photoFile(img.url));
    const cover =
      main.find(fresh) ??
      newest.flatMap((p) => p.images.filter(real)).find(fresh) ??
      main[0] ??
      null;
    if (cover) used.add(photoFile(cover.url));
    return { id: i + 1, slug, name: { az, en, ru }, productCount: listed.length, cover };
  });
}

export const OCCASIONS: OccasionCollection[] = withCovers();
