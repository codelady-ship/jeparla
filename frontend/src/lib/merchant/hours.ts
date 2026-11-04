/**
 * Week editor model for store opening hours. Stores keep the schema.org string
 * ("Mo-Sa 10:00-20:00", rules separated by ";"), which the public store page and
 * JSON-LD already read; the profile form edits one row per weekday.
 */
export const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
export type Day = (typeof WEEK)[number];
export type DayHours = { open: boolean; from: string; to: string };
export type WeekHours = DayHours[];

const CLOSED: DayHours = { open: false, from: "10:00", to: "19:00" };
const RULE = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseWeek(value: string): WeekHours {
  const week: WeekHours = WEEK.map(() => ({ ...CLOSED }));
  for (const raw of value.split(/[;,]/)) {
    const m = RULE.exec(raw.trim());
    if (!m) continue;
    const [, a, b, from, to] = m;
    const start = WEEK.indexOf(a as Day);
    const end = b ? WEEK.indexOf(b as Day) : start;
    for (let i = start; i <= end; i++) week[i] = { open: true, from, to };
  }
  return week;
}

/** Groups consecutive days with the same hours: Mo-Fr 10:00-19:00; Sa 11:00-17:00. */
export function formatWeek(week: WeekHours): string {
  const rules: string[] = [];
  let i = 0;
  while (i < WEEK.length) {
    const d = week[i];
    if (!d?.open) {
      i++;
      continue;
    }
    let j = i;
    while (
      j + 1 < WEEK.length &&
      week[j + 1]?.open &&
      week[j + 1].from === d.from &&
      week[j + 1].to === d.to
    )
      j++;
    const days = j > i ? `${WEEK[i]}-${WEEK[j]}` : WEEK[i];
    rules.push(`${days} ${d.from}-${d.to}`);
    i = j + 1;
  }
  return rules.join("; ");
}

/** Indexes of open days whose times are malformed or close before they open. */
export function invalidDays(week: WeekHours): number[] {
  return week.flatMap((d, i) =>
    d.open && (!TIME.test(d.from) || !TIME.test(d.to) || d.from >= d.to) ? [i] : [],
  );
}
