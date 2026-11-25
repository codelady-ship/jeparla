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

/** Finenesses a leading 3-digit group may be: "585 450 AZN" is a fineness and a price, not 585450. */
const FINENESS_GROUP = "(?:375|583|585|750|875|916|925|950|999)";
// Numbers: "1 250,50", "1250.5", "4,2". A space or no-break space may group thousands, but never
// after a fineness ("585 450").
const NUM = String.raw`((?!${FINENESS_GROUP}[  ]\d{3}(?!\d))\d{1,3}(?:[  ]\d{3})+(?!\d)|\d+)(?:[.,](\d{1,3}))?`;
const CURRENCY = String.raw`(?:₼|azn|manat|man\.|манат)`;
const PRICE_AFTER = String.raw`(?<![\d.,])${NUM}\s*${CURRENCY}`;
const PRICE_BEFORE = String.raw`${CURRENCY}\s*${NUM}`;
const PRICE_LABEL = String.raw`(?:qiymet|price|цена|стоимость)\s*[:\-]?\s*${NUM}`;
const GRAM = String.raw`(?:qram|gram|qr|gr|q|g|гр|г)(?![\p{L}\p{N}])`;
const WEIGHT_UNIT = String.raw`(?<![\d.,])${NUM}\s*${GRAM}`;
const WEIGHT_LABEL = String.raw`(?:ceki|weight|вес|масса)\s*[:\-]?\s*${NUM}`;
const re = (source: string, flags = "") => new RegExp(source, `u${flags}`);
/** A number followed by a price, weight or size unit is never a fineness. */
const UNIT_AFTER = re(String.raw`^\s*(?:${CURRENCY}|${GRAM}|mm|sm|cm|мм|см|%)`);

/** Azerbaijani phone numbers (+994 50 585 12 34, 055 585 12 34) and other long digit runs. */
const PHONE = re(
  String.raw`(?:\+\s?994|(?<![\d.,])0)[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)` +
    String.raw`|(?<![\d.,])\d{1,4}(?:[\s-]\d{2,4}){3,}(?!\d)`,
  "g",
);
/** "2025 г.", "2024 il": a year, not grams. */
const YEAR = re(
  String.raw`(?<![\d.,])(?:19|20)\d{2}\s*(?:г\.|год|ил|il|year|г)(?![\p{L}\p{N}])`,
  "gi",
);
const HASHTAGS = /^(?:#[\p{L}\p{N}_]+[\s,.]*)+$/u;
/** Lines that are a contact, not product data: a phone number or only hashtags. */
const isContactLine = (line: string) => re(PHONE.source).test(line) || HASHTAGS.test(line.trim());

const decimal = (whole: string, frac: string | undefined) =>
  whole.replace(/[  ]/g, "") + (frac ? `.${frac}` : "");

function price(text: string): string | null {
  for (const source of [PRICE_AFTER, PRICE_BEFORE, PRICE_LABEL]) {
    for (const m of text.matchAll(re(source, "g"))) {
      // Money has at most 2 decimals; "1.250" is not a price we can read safely.
      if (m[2] && m[2].length > 2) continue;
      const v = decimal(m[1], m[2]);
      if (Number(v) > 0 && v.replace(".", "").length <= 10) return v;
    }
  }
  return null;
}

/** A labelled weight ("Çəki: 3,2") first; a bare "3,2 q" only up to 1000 g (a year is not grams). */
function weight(text: string): string | null {
  for (const m of text.matchAll(re(WEIGHT_LABEL, "g"))) {
    const v = decimal(m[1], m[2]);
    if (Number(v) > 0 && Number(v) <= 10_000) return v;
  }
  for (const m of text.matchAll(re(WEIGHT_UNIT, "g"))) {
    const v = decimal(m[1], m[2]);
    if (Number(v) > 0 && Number(v) <= 1000) return v;
  }
  return null;
}

const METAL_WORDS: [MetalType, RegExp][] = [
  ["GOLD", /qizil|\bgold|(?<!по)золот/gu],
  ["SILVER", /gumus|silver|серебр/gu],
  ["PLATINUM", /platin|платин/gu],
  ["PALLADIUM", /palladi|паллади/gu],
];
/** "gold plated", "qızıl suyuna", "qızıl örtüklü", "qızılı rəngli", "gold-filled": a coating. */
const COATING_AFTER =
  /^\p{L}*[\s-]*(?:plated|plating|filled|tone|vermeil|suy|ortu|rengl|покрыт|напылен)/u;

/** Metals the text names as the material, in order; coatings and colours do not count. */
function metalWords(text: string): MetalType[] {
  const found: { metal: MetalType; at: number }[] = [];
  for (const [metal, pattern] of METAL_WORDS)
    for (const m of text.matchAll(pattern)) {
      const at = m.index ?? 0;
      if (COATING_AFTER.test(text.slice(at + m[0].length, at + m[0].length + 20))) continue;
      found.push({ metal, at });
    }
  return found.sort((a, b) => a.at - b.at).map((f) => f.metal);
}

/** Gold karats as finenesses: 9K = 375, 14K = 585, 18K = 750, 22K = 916, 24K = 999. */
const KARAT: Record<string, number> = { "9": 375, "14": 585, "18": 750, "22": 916, "24": 999 };
const KARAT_RE = /(?<![\d.,])(9|14|18|22|24)\s?(?:k|kt|karat|карат)(?![\p{L}\p{N}])/u;
/** A bare "585" counts only on a line that names a metal or the word for fineness. */
const FINENESS_WORD =
  /eyar|ayar|proba|проб|fineness|hallmark|damga|qizil|gold|золот|gumus|silver|серебр|platin|платин|palladi|паллади/u;

/** Three-digit finenesses that stand alone, next to a metal or fineness word. */
function finenessNumbers(text: string): number[] {
  // Prices, weights (also labelled ones without a unit) are blanked out first.
  let rest = text;
  for (const source of [PRICE_AFTER, PRICE_BEFORE, PRICE_LABEL, WEIGHT_LABEL, WEIGHT_UNIT])
    rest = rest.replace(re(source, "g"), (s) => " ".repeat(s.length));
  const found: number[] = [];
  for (const line of rest.split("\n")) {
    if (!FINENESS_WORD.test(line)) continue;
    for (const m of line.matchAll(/(?<![\d.,])(\d{3})(?![\d]|[.,]\d)/gu)) {
      if (UNIT_AFTER.test(line.slice((m.index ?? 0) + m[0].length))) continue;
      found.push(Number(m[1]));
    }
  }
  return found;
}

function metalAndFineness(
  text: string,
  finenesses: AutofillFineness[],
): { metal: MetalType | null; fineness: string | null } {
  const named = metalWords(text)[0] ?? null;
  const karat = KARAT_RE.exec(text);
  const candidates: { value: number; gold?: boolean }[] = [
    ...(karat ? [{ value: KARAT[karat[1]], gold: true }] : []),
    ...finenessNumbers(text).map((value) => ({ value })),
  ];
  let conflict = false;
  for (const c of candidates) {
    const options = finenesses.filter(
      (f) => f.fineness === c.value && (!c.gold || f.metal === "GOLD"),
    );
    const mine = named ? options.filter((f) => f.metal === named) : options;
    // Without a metal word the number must belong to one metal only (999 is gold or silver).
    if (mine.length === 1) return { metal: mine[0].metal, fineness: mine[0].value };
    // "Qızıl sırğa 925": the word and the number disagree, so neither is trusted.
    if (named && mine.length === 0 && options.length > 0) conflict = true;
  }
  return { metal: conflict ? null : named, fineness: null };
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
  for (const [slug, pattern] of CATEGORY_WORDS)
    if (offered.has(slug) && pattern.test(text)) return slug;
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

const DATA_PATTERNS = [PRICE_AFTER, PRICE_BEFORE, PRICE_LABEL, WEIGHT_UNIT, WEIGHT_LABEL].map(
  (source) => re(source),
);

/** A line with a price or weight (labelled or not), a contact, or no words is not a name or a sentence. */
function isDataLine(line: string): boolean {
  const folded = fold(line);
  return (
    DATA_PATTERNS.some((p) => p.test(folded)) || isContactLine(line) || !/\p{L}{2}/u.test(folded)
  );
}

/** Words a one-line head may not start with: labels, not names. */
const NOT_A_NAME =
  /^(?:ceki|weight|вес|масса|qiymet|price|цена|стоимость|model|модель|proba|проба|eyar|ayar|fineness)(?![\p{L}])/u;

const fitsName = (l: string) => l.length >= NAME_MIN && l.length <= NAME_MAX;

/**
 * The first line that reads like a name: letters, 3 to 120 characters, no price, weight or contact.
 * One-line text ("Leyla — qızıl üzük, 585, 3,2 q, 450 AZN") gives the part before the first comma
 * or digit.
 */
function name(all: string[]): string | null {
  const line = all.find((l) => fitsName(l) && !isDataLine(l));
  if (line) return line;
  const first = all.find((l) => !isContactLine(l));
  const head = first
    ?.split(/[,;\d]/u)[0]
    .replace(/[\s\-–—:.]+$/u, "")
    .replace(/\s+(?:proba|проба|əyar|eyar|ayar)$/iu, "")
    .trim();
  // One word ("Gold", "Model") or a label ("Çəki: ...") is not a product name.
  if (!head || !/\s/u.test(head) || NOT_A_NAME.test(fold(head))) return null;
  return fitsName(head) && /\p{L}{2}/u.test(head) && !isDataLine(head) ? head : null;
}

/** The rest of the text as sentences: lines other than the name, data and contact lines. */
function description(all: string[], title: string | null): string | null {
  const rest = all.filter((l) => l !== title && !isDataLine(l));
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
  const title = name(all);
  // Phone numbers and years are removed before any number is read.
  // Hashtag-only lines ("#qizil #uzuk") are tags, not a description of this piece: they never
  // decide the metal or the category.
  const folded = fold(
    all
      .filter((l) => !HASHTAGS.test(l.trim()))
      .map((l) => l.replace(PHONE, " ").replace(YEAR, " "))
      .join("\n"),
  );
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
