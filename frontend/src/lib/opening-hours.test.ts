import { describe, expect, it } from "vitest";
import { bakuClock, formatOpeningHours, openState } from "./opening-hours";

describe("formatOpeningHours", () => {
  it("localizes day ranges", () => {
    const [en] = formatOpeningHours("Mo-Sa 10:00-20:00", "en");
    expect(en).toBe("Mon–Sat 10:00–20:00");
    const [ru] = formatOpeningHours("Mo-Sa 10:00-20:00", "ru");
    expect(ru.toLowerCase()).toMatch(/^пн–сб 10:00–20:00$/);
  });

  it("handles several rules and single days", () => {
    expect(formatOpeningHours("Mo-Fr 09:00-18:00; Su 11:00-16:00", "en")).toEqual([
      "Mon–Fri 09:00–18:00",
      "Sun 11:00–16:00",
    ]);
  });

  it("keeps text it cannot parse", () => {
    expect(formatOpeningHours("by appointment", "en")).toEqual(["by appointment"]);
  });
});

// Baku is UTC+4 all year. 2026-11-16 is a Monday.
const baku = (iso: string) => new Date(`${iso}+04:00`);

describe("bakuClock", () => {
  it("reads the weekday and time in Baku, not UTC", () => {
    // 22:30 UTC on Sunday is already 02:30 on Monday in Baku.
    expect(bakuClock(new Date("2026-11-15T22:30:00Z"))).toEqual({ day: 0, minutes: 150 });
  });
});

describe("openState", () => {
  const hours = "Mo-Sa 10:00-20:00";

  it("is open inside the hours", () => {
    expect(openState(hours, baku("2026-11-16T10:00:00"))).toEqual({ open: true });
    expect(openState(hours, baku("2026-11-21T19:59:00"))).toEqual({ open: true });
  });

  it("says when a closed store opens: today, tomorrow or after the day off", () => {
    expect(openState(hours, baku("2026-11-16T08:15:00"))).toEqual({
      open: false,
      opensAt: { inDays: 0, day: 0, time: "10:00" },
    });
    expect(openState(hours, baku("2026-11-16T20:00:00"))).toEqual({
      open: false,
      opensAt: { inDays: 1, day: 1, time: "10:00" },
    });
    // Saturday evening: Sunday is closed, so Monday.
    expect(openState(hours, baku("2026-11-21T21:00:00"))).toEqual({
      open: false,
      opensAt: { inDays: 2, day: 0, time: "10:00" },
    });
  });

  it("handles hours that run past midnight, including Sunday into Monday", () => {
    const night = "Fr-Su 18:00-02:00";
    expect(openState(night, baku("2026-11-21T01:30:00"))).toEqual({ open: true }); // Sat 01:30
    expect(openState(night, baku("2026-11-16T01:59:00"))).toEqual({ open: true }); // Mon 01:59
    expect(openState(night, baku("2026-11-16T02:00:00"))).toEqual({
      open: false,
      opensAt: { inDays: 4, day: 4, time: "18:00" },
    });
  });

  it("claims nothing for hours it cannot read", () => {
    expect(openState("by appointment", baku("2026-11-16T12:00:00"))).toBeNull();
  });
});
