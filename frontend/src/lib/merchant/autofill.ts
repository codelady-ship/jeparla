import type { MetalType } from "@/types/api";

/**
 * Reads a product's text (a catalog PDF page, later also the text of a photo) and suggests the
 * product form fields: name, category, metal, fineness, weight, price and description. Plain
 * rules, no AI and no network: Azerbaijani, English and Russian words, "585", "14K", "4,2 q",
 * "1 250 AZN". Only suggestions: the seller sees every field in the form and confirms or changes
 * it; a field the text does not make clear stays empty rather than guessed.
 */

export type AutofillCategory = { value: string; label: string };
export type AutofillFineness = { value: string; metal: MetalType; fineness: number };

export type AutofillField =
  "name" | "category" | "metal" | "fineness" | "weight" | "price" | "description";

export type Autofill = {
  name: string | null;
  /** A category option value (slug); only leaf categories the form offers. */
  category: string | null;
  metal: MetalType | null;
  /** A fineness option value (id); always one of the chosen metal. */
  fineness: string | null;
  /** Grams as a decimal string with a dot, e.g. "4.2". */
  weight: string | null;
  /** Manat as a decimal string with a dot, e.g. "1250.50". */
  price: string | null;
  description: string | null;
};

const NAME_MIN = 3;
const NAME_MAX = 120;
const DESCRIPTION_MAX = 1000;

/** Lower case, Azerbaijani letters as ASCII (ə -> e, ı -> i, ...); Cyrillic stays. */
export function fold(text: string): string {
  return text
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");
}

// Numbers: "1 250,50", "1250.5", "4,2". A space or no-break space may group thousands.
const NUM = String.raw`(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,](\d{1,3}))?`;
const CURRENCY = String.raw`(?:₼|azn|manat|man\.|манат)`;
const PRICE_AFTER = new RegExp(String.raw`(?<![\d.,])${NUM}\s*${CURRENCY}`, "u");
const PRICE_BEFORE = new RegExp(String.raw`${CURRENCY}\s*${NUM}`, "u");
const PRICE_LABEL = new RegExp(String.raw`(?:qiymet|price|цена|стоимость)\s*[:\-]?\s*${NUM}`, "u");
const GRAM = String.raw`(?:qram|gram|qr|gr|q|g|гр|г)(?![\p{L}\p{N}])`;
const WEIGHT_UNIT = new RegExp(String.raw`(?<![\d.,])${NUM}\s*${GRAM}`, "gu");
const WEIGHT_LABEL = new RegExp(String.raw`(?:ceki|weight|вес|масса)\s*[:\-]?\s*${NUM}`, "u");
/** A number followed by a price or weight unit is never a fineness. */
const UNIT_AFTER = new RegExp(String.raw`^\s*(?:${CURRENCY}|${GRAM}|mm|sm|cm|мм|см|%)`, "u");

const decimal = (whole: string, frac: string | undefined) =>
  whole.replace(/[  ]/g, "") + (frac ? `.${frac}` : "");

function price(text: string): string | null {
  for (const re of [PRICE_AFTER, PRICE_BEFORE, PRICE_LABEL]) {
    const m = re.exec(text);
    if (!m) continue;
    // Money has at most 2 decimals; "1.250" is not a price we can read safely.
    if (m[2] && m[2].length > 2) continue;
    const v = decimal(m[1], m[2]);
    if (Number(v) > 0 && v.replace(".", "").length <= 10) return v;
  }
  return null;
}

function weight(text: string): string | null {
  for (const m of text.matchAll(WEIGHT_UNIT)) {
    const v = decimal(m[1], m[2]);
    if (Number(v) > 0 && Number(v) <= 10_000) return v;
  }
  const m = WEIGHT_LABEL.exec(text);
  if (m) {
    const v = decimal(m[1], m[2]);
    if (Number(v) > 0 && Number(v) <= 10_000) return v;
  }
  return null;
}

const METAL_WORDS: [MetalType, RegExp][] = [
  ["GOLD", /qizil|\bgold|золот/u],
  ["SILVER", /gumus|silver|серебр/u],
  ["PLATINUM", /platin|платин/u],
  ["PALLADIUM", /palladi|паллади/u],
];

/** The metal named first in the text. */
function metalWord(text: string): MetalType | null {
  let best: { metal: MetalType; at: number } | null = null;
  for (const [metal, re] of METAL_WORDS) {
    const at = text.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { metal, at };
  }
  return best?.metal ?? null;
}

/** Gold karats as finenesses: 9K = 375, 14K = 585, 18K = 750, 22K = 916, 24K = 999. */
const KARAT: Record<string, number> = { "9": 375, "14": 585, "18": 750, "22": 916, "24": 999 };
const KARAT_RE = /(?<![\d.,])(9|14|18|22|24)\s?(?:k|kt|karat|карат)(?![\p{L}\p{N}])/u;

/** Three-digit finenesses that stand alone (not part of a price, weight or size). */
function finenessNumbers(text: string): number[] {
  const found: number[] = [];
  for (const m of text.matchAll(/(?<![\d.,])(\d{3})(?![\d]|[.,]\d)/gu)) {
    const rest = text.slice((m.index ?? 0) + m[0].length);
    if (UNIT_AFTER.test(rest)) continue;
    found.push(Number(m[1]));
  }
  return found;
}

function metalAndFineness(
  text: string,
  finenesses: AutofillFineness[],
): { metal: MetalType | null; fineness: string | null } {
  const named = metalWord(text);
  const karat = KARAT_RE.exec(text);
  const candidates: { value: number; gold?: boolean }[] = [
    ...(karat ? [{ value: KARAT[karat[1]], gold: true }] : []),
    ...finenessNumbers(text).map((value) => ({ value })),
  ];
  for (const c of candidates) {
    const options = finenesses.filter(
      (f) => f.fineness === c.value && (!c.gold || f.metal === "GOLD"),
    );
    const mine = named ? options.filter((f) => f.metal === named) : options;
    // Without a metal word the number must belong to one metal only (999 is gold or silver).
    if (mine.length === 1) return { metal: mine[0].metal, fineness: mine[0].value };
  }
  return { metal: named, fineness: null };
}

/**
 * Category words in priority order: who it is for (kids, men) and sets first, then the piece.
 * "üzük" alone and "boyunbağı" alone are parents in the catalog, so they choose nothing.
 */
const CATEGORY_WORDS: [string, RegExp][] = [
  ["usaq-zergerliyi", /usaq|\bkids?\b|child|детск/u],
  ["kisi-zergerliyi", /kisi|\bmen'?s\b|мужск/u],
  ["destler", /\bdest|jewel(?:le)?ry set|\bset\b|комплект|гарнитур/u],
  ["nisan-uzukleri", /nisan|engagement|помолв/u],
  ["toy-uzukleri", /\btoy\b|wedding|обручал/u],
  ["broslar", /\bbros|brooch|брош/u],
  ["asqilar", /asqi|pendant|кулон|подвес/u],
  ["zencirler", /zencir|\bchain|цепь|цепоч/u],
  ["sirgalar", /sirga|earring|серьг/u],
  ["qolbaqlar", /qolbaq|bilerzik|bracelet|браслет/u],
];

function category(text: string, categories: AutofillCategory[]): string | null {
  const offered = new Set(categories.map((c) => c.value));
  for (const [slug, re] of CATEGORY_WORDS) if (offered.has(slug) && re.test(text)) return slug;
  // A category an admin added later: its own name in the text.
  for (const c of categories) {
    const label = fold(c.label).trim();
    if (label.length >= 4 && text.includes(label)) return c.value;
  }
  return null;
}

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/** A line that carries only numbers, a price or a weight is data, not a name or a sentence. */
function isDataLine(folded: string): boolean {
  return (
    PRICE_AFTER.test(folded) ||
    PRICE_BEFORE.test(folded) ||
    new RegExp(WEIGHT_UNIT.source, "u").test(folded) ||
    !/\p{L}{2}/u.test(folded)
  );
}

/** The first line that reads like a name: letters, 3 to 120 characters, no price or weight. */
function name(all: string[]): string | null {
  return (
    all.find((l) => l.length >= NAME_MIN && l.length <= NAME_MAX && !isDataLine(fold(l))) ?? null
  );
}

/** The rest of the text as sentences: lines other than the name and the bare data lines. */
function description(all: string[], title: string | null): string | null {
  const rest = all.filter((l) => l !== title && !isDataLine(fold(l)));
  const text = rest.join(" ").trim();
  if (text.length < 10) return null;
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX);
  const end = cut.lastIndexOf(". ");
  return end > DESCRIPTION_MAX / 2 ? cut.slice(0, end + 1) : cut.trimEnd();
}

export function readProductText(
  text: string,
  options: { categories: AutofillCategory[]; finenesses: AutofillFineness[] },
): Autofill {
  const all = lines(text ?? "");
  const folded = fold(all.join("\n"));
  const title = name(all);
  const { metal, fineness } = metalAndFineness(folded, options.finenesses);
  return {
    name: title,
    category: category(folded, options.categories),
    metal,
    fineness,
    weight: weight(folded),
    price: price(folded),
    description: description(all, title),
  };
}

/** The fields a reading filled, in form order, for the "filled from the file" note. */
export function filledFields(a: Autofill): AutofillField[] {
  const order: [AutofillField, unknown][] = [
    ["name", a.name],
    ["category", a.category],
    ["metal", a.metal],
    ["fineness", a.fineness],
    ["weight", a.weight],
    ["price", a.price],
    ["description", a.description],
  ];
  return order.filter(([, v]) => v !== null).map(([k]) => k);
}
