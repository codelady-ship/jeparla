/** Parses "1,2,3" from a query string into unique positive ints, at most `max`. */
export function parseIds(raw: string | null, max: number): number[] {
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  return [...new Set(ids)].slice(0, max);
}
