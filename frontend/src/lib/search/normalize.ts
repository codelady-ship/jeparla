// Folds Azerbaijani, Turkish and Russian-keyboard-free spellings so that
// "uzuk" finds "üzük", "sirga" finds "sırğa", "qizil" finds "qızıl" (PLAN 5.3).
// The backend uses the same table for its unaccented search column.
const FOLD: Record<string, string> = {
  ə: "e",
  ı: "i",
  i̇: "i",
  ş: "s",
  ç: "c",
  ğ: "g",
  ö: "o",
  ü: "u",
};

export function normalizeQuery(text: string): string {
  return text
    .toLocaleLowerCase("az")
    .replace(/i̇|[əışçğöü]/g, (ch) => FOLD[ch] ?? ch)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when every word of the query appears (as a prefix) in the text. */
export function matchesQuery(text: string, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const words = normalizeQuery(text).split(" ");
  return q.split(" ").every((part) => words.some((w) => w.startsWith(part)));
}
