import { describe, expect, it } from "vitest";
import { formatOpeningHours } from "./opening-hours";

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
