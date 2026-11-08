import { describe, expect, it } from "vitest";
import { adminApi } from "@/lib/api/admin";
import { nextStatus } from "./decisions";
import { errorKey } from "./errors";
import {
  categorySchema,
  fieldErrors,
  finenessSchema,
  overrideSchema,
  priceJump,
  roleSchema,
  splitSynonyms,
  synonymSchema,
} from "./settings";

describe("catalog schemas", () => {
  const name = { az: "Saatlar", en: "Watches", ru: "Часы" };

  it("accepts a clean slug and refuses spaces, capitals and Azerbaijani letters", () => {
    expect(categorySchema.safeParse({ slug: "qol-saatlari", name }).success).toBe(true);
    for (const slug of ["Qol saatlari", "saatlar-", "qol-saatları", "a"]) {
      const r = categorySchema.safeParse({ slug, name });
      expect(r.success, slug).toBe(false);
      expect(fieldErrors(r.error!).slug).toBe("slugFormat");
    }
  });

  it("needs a name in every language", () => {
    const r = categorySchema.safeParse({ slug: "saatlar", name: { ...name, ru: " " } });
    expect(fieldErrors(r.error!)["name.ru"]).toBe("required");
  });

  it("keeps fineness within 1-999", () => {
    expect(finenessSchema.safeParse({ metal: "GOLD", value: 916, label: "916" }).success).toBe(
      true,
    );
    for (const value of [0, 1000, 58.5, NaN]) {
      const r = finenessSchema.safeParse({ metal: "GOLD", value, label: "x" });
      expect(fieldErrors(r.error!).value, String(value)).toBe("valueRange");
    }
  });

  it("splits synonyms on commas and caps the group", () => {
    expect(splitSynonyms(" uzuk, üzüy ,,")).toEqual(["uzuk", "üzüy"]);
    const many = Array.from({ length: 11 }, (_, i) => `s${i}`);
    const r = synonymSchema.safeParse({ locale: "az", term: "üzük", synonyms: many });
    expect(fieldErrors(r.error!).synonyms).toBe("tooMany");
  });
});

describe("role change and price override", () => {
  it("needs a reason for a role change", () => {
    const r = roleSchema.safeParse({ role: "ADMIN", reason: "short" });
    expect(fieldErrors(r.error!).reason).toBe("reasonRequired");
    expect(roleSchema.safeParse({ role: "OWNER", reason: "x".repeat(20) }).success).toBe(false);
  });

  it("reads a decimal price with a comma or a dot and refuses the rest", () => {
    const ok = overrideSchema.safeParse({ pricePerOunce: "7012,5", reason: "x".repeat(10) });
    expect(ok.data?.pricePerOunce).toBe("7012.5");
    for (const p of ["0", "-5", "1e3", "12.345", "abc"]) {
      const r = overrideSchema.safeParse({ pricePerOunce: p, reason: "x".repeat(10) });
      expect(fieldErrors(r.error!).pricePerOunce, p).toBe("priceFormat");
    }
  });

  it("flags a change above 10% in either direction, not at exactly 10%", () => {
    expect(priceJump("100.00", "110.00")).toEqual({ change: "10.0", large: false });
    expect(priceJump("100.00", "110.06")).toEqual({ change: "10.1", large: true });
    expect(priceJump("100.00", "88.00").large).toBe(true);
  });
});

describe("complaints and held quotes", () => {
  it("allows each decision once", () => {
    expect(nextStatus("report", "OPEN", "dismiss")).toBe("DISMISSED");
    expect(nextStatus("report", "RESOLVED", "resolve")).toBeNull();
    expect(nextStatus("quote", "HELD", "accept")).toBe("APPLIED");
    expect(nextStatus("quote", "DISCARDED", "accept")).toBeNull();
  });

  it("maps unknown error codes to a server error", () => {
    expect(errorKey("lastAdmin")).toBe("lastAdmin");
    expect(errorKey("<b>")).toBe("server");
  });

  it("demo data has an open complaint and a held palladium quote", async () => {
    const o = await adminApi.overview();
    expect(o.openReports).toBeGreaterThan(0);
    expect(o.heldPrices).toBe(1);
    const palladium = (await adminApi.metalPrices()).find((m) => m.metal === "PALLADIUM");
    expect(palladium?.held?.change).toBe("12.4");
    const users = await adminApi.users();
    expect(users.filter((u) => u.role === "ADMIN")).toHaveLength(1);
  });
});
