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

const MINUTES_PER_DAY = 24 * 60;
const WEEK = 7 * MINUTES_PER_DAY;
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

type Interval = { day: number; open: number; close: number };

/** Parsed rules, one entry per day; a closing time at or before the opening runs past midnight. */
function intervals(value: string): Interval[] {
  const out: Interval[] = [];
  for (const rule of value.split(/[;,]/)) {
    const m = RULE.exec(rule.trim());
    if (!m) continue;
    const [, from, to, open, close] = m;
    const a = DAYS.indexOf(from as (typeof DAYS)[number]);
    const b = to ? DAYS.indexOf(to as (typeof DAYS)[number]) : a;
    for (let i = 0; i < 7; i++) {
      const day = (a + i) % 7;
      out.push({ day, open: toMinutes(open), close: toMinutes(close) });
      if (day === b) break;
    }
  }
  return out;
}

/**
 * Baku is UTC+4 all year (no daylight saving since 2016). Plain arithmetic instead of
 * Intl.DateTimeFormat with timeZone "Asia/Baku": loading the time zone data cost 50-80 ms
 * of main thread on a phone while the home page hydrated its store cards (#62).
 */
const BAKU_OFFSET_MS = 4 * 60 * 60_000;

/** Day of week (0 = Monday) and minutes since midnight in Baku. */
export function bakuClock(now: Date): { day: number; minutes: number } {
  const baku = new Date(now.getTime() + BAKU_OFFSET_MS);
  return {
    day: (baku.getUTCDay() + 6) % 7,
    minutes: baku.getUTCHours() * 60 + baku.getUTCMinutes(),
  };
}

export type OpenState =
  | { open: true }
  | {
      open: false;
      /** `inDays`: 0 today, 1 tomorrow and so on; `day`: 0 = Monday. */
      opensAt: { inDays: number; day: number; time: string } | null;
    };

/**
 * Whether a store is open at `now` (Baku time) and when it opens next.
 * Null when the hours cannot be read, so the page claims nothing.
 */
export function openState(value: string, now: Date): OpenState | null {
  const list = intervals(value);
  if (list.length === 0) return null;
  const { day, minutes } = bakuClock(now);
  // Minutes since Monday 00:00; the week wraps around.
  const current = day * MINUTES_PER_DAY + minutes;
  let next: number | null = null;
  for (const { day: d, open, close } of list) {
    const start = d * MINUTES_PER_DAY + open;
    const length = close > open ? close - open : close + MINUTES_PER_DAY - open;
    // Last week's Sunday night can still be running on Monday morning.
    for (const s of [start - WEEK, start, start + WEEK]) {
      if (current >= s && current < s + length) return { open: true };
      if (s > current && (next === null || s < next)) next = s;
    }
  }
  if (next === null) return { open: false, opensAt: null };
  const nextDay = Math.floor(next / MINUTES_PER_DAY);
  const at = next % MINUTES_PER_DAY;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    open: false,
    opensAt: {
      inDays: nextDay - day,
      day: nextDay % 7,
      time: `${pad(Math.floor(at / 60))}:${pad(at % 60)}`,
    },
  };
}
