/**
 * Demo data for building the frontend before the backend exists (issue #6).
 * Everything here is invented: store names, addresses, phone numbers (+994 50 000 00 0X)
 * and metal prices are not real and must never be shown as real data in production.
 * Generated deterministically (no Math.random, no Date.now) so builds are reproducible.
 */
import Big from "big.js";
import { gramPrice, metalLinkedPrice } from "@/lib/pricing";
import type {
  Category,
  Fineness,
  LocalizedText,
  MetalPrice,
  MetalType,
  PricingRule,
  Product,
  Stone,
  Store,
  Verification,
} from "@/types/api";

const VERIFIED: Verification = { seller: "VERIFIED", documents: "VERIFIED", expertise: "NONE" };
const SELLER_ONLY: Verification = { seller: "VERIFIED", documents: "PENDING", expertise: "NONE" };
const NEW_STORE: Verification = { seller: "PENDING", documents: "NONE", expertise: "NONE" };

// ---------------------------------------------------------------- finenesses
export const FINENESSES: Fineness[] = [
  { id: 1, metal: "GOLD", value: 375, label: "375 (9K)" },
  { id: 2, metal: "GOLD", value: 585, label: "585 (14K)" },
  { id: 3, metal: "GOLD", value: 750, label: "750 (18K)" },
  { id: 4, metal: "GOLD", value: 999, label: "999 (24K)" },
  { id: 5, metal: "SILVER", value: 925, label: "925" },
  { id: 6, metal: "PLATINUM", value: 950, label: "950" },
];

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
  if (i % 20 === 7) return { metal: "PLATINUM", fineness: FINENESSES[5] };
  if (i % 4 === 1) return { metal: "SILVER", fineness: FINENESSES[4] };
  const gold = [FINENESSES[1], FINENESSES[2], FINENESSES[1], FINENESSES[0], FINENESSES[3]];
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
  const pricingMode = i % 3 === 2 ? "FIXED" : "METAL_LINKED";
  const linked = metalLinkedPrice({
    weightGrams: weight,
    fineness: fineness.value,
    pureGramPrice: pureGram(metal),
    rule,
  });
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
    metal,
    priceFrom: { amount, currency: "AZN" },
    pricingMode,
    fineness: fineness.value,
    weightGrams: weight,
    images: [
      {
        url: "/placeholders/product.svg",
        alt: name,
        width: 800,
        height: 1000,
      },
    ],
    hasStones: withStone,
    verification,
    stockStatus,
    publishedAt,
    description: {
      az: `${name.az}. Çəki ${weight} q. Nümunə məhsul.`,
      en: `${name.en}. Weight ${weight} g. Demo product.`,
      ru: `${name.ru}. Вес ${weight} г. Демонстрационный товар.`,
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
      },
    ],
    stones,
    status: "APPROVED",
  };
}

export const PRODUCTS: Product[] = Array.from({ length: 60 }, (_, i) => buildProduct(i));

for (const s of STORES) s.productCount = PRODUCTS.filter((p) => p.store.id === s.id).length;

export const CATEGORIES: Category[] = CAT_SEEDS.map(([id, slug, parentId, az, en, ru]) => ({
  id,
  slug,
  parentId,
  name: { az, en, ru },
  productCount: PRODUCTS.filter((p) => p.categoryId === id || CAT_SEEDS[p.categoryId - 1][2] === id)
    .length,
}));
