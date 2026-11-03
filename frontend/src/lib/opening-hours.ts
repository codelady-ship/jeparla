/**
 * Stores keep hours in schema.org openingHours form ("Mo-Sa 10:00-20:00", several
 * rules separated by ";" or ","). This turns them into localized lines and leaves
 * anything it cannot parse as written.
 */
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
// 2024-01-01 was a Monday.
const dayName = (i: number, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 1 + i)),
  );

const RULE = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/;

export function formatOpeningHours(value: string, locale: string): string[] {
  return value
    .split(/[;,]/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((rule) => {
      const m = RULE.exec(rule);
      if (!m) return rule;
      const [, from, to, open, close] = m;
      const a = dayName(DAYS.indexOf(from as (typeof DAYS)[number]), locale);
      const days = to ? `${a}–${dayName(DAYS.indexOf(to as (typeof DAYS)[number]), locale)}` : a;
      return `${days} ${open}–${close}`;
    });
}
