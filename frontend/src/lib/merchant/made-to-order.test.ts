import { describe, expect, it } from "vitest";
import { profileSchema } from "./schemas";

const profile = {
  name: "Test Zərgər",
  whatsapp: "050 123 45 67",
  city: "Bakı",
  address: "Nizami küçəsi 5",
  social: "",
  description: "",
  openingHours: "",
};

describe("made to order in the store profile (#108)", () => {
  it("is optional, may be cleared and keeps whole days", () => {
    expect(profileSchema.safeParse(profile).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, madeToOrder: null }).success).toBe(true);
    expect(
      profileSchema.safeParse({ ...profile, madeToOrder: { offered: null, days: null } }).success,
    ).toBe(true);
    expect(
      profileSchema.safeParse({ ...profile, madeToOrder: { offered: true, days: 10 } }).success,
    ).toBe(true);
  });

  it("refuses days outside 1..365 or not whole", () => {
    for (const days of [0, 366, 1.5, Number.NaN]) {
      const r = profileSchema.safeParse({ ...profile, madeToOrder: { offered: true, days } });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].message).toBe("daysInvalid");
    }
  });
});
