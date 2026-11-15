import { describe, expect, it } from "vitest";
import { SHARE_PATH, shareLocale, shareTarget } from "./share-link";
import { readReferral, referralSourceFor, rememberReferral, sourceFrom } from "./referral";
import { emptyReferralStats } from "./api/merchant";

describe("share link /s/<code> (#100)", () => {
  it("matches only a short code path", () => {
    expect("/s/k7m2q9xa".match(SHARE_PATH)?.[1]).toBe("k7m2q9xa");
    expect("/s/k7m2q9xa/".match(SHARE_PATH)?.[1]).toBe("k7m2q9xa");
    expect("/s/k7m2q9xa/x".match(SHARE_PATH)).toBeNull();
    expect("/az/s/k7m2q9xa".match(SHARE_PATH)).toBeNull();
    expect("/s/../admin".match(SHARE_PATH)).toBeNull();
  });

  it("picks the language from the cookie, then Accept-Language, then az", () => {
    expect(shareLocale("ru", "en-US,en;q=0.9")).toBe("ru");
    expect(shareLocale(undefined, "de-DE,ru;q=0.8,en;q=0.9")).toBe("en");
    expect(shareLocale("xx", "tr,az;q=0.5")).toBe("az");
    expect(shareLocale(undefined, "fr-FR")).toBe("az");
    expect(shareLocale(undefined, null)).toBe("az");
    expect(shareLocale(undefined, "en;q=0, ru")).toBe("ru");
  });

  it("keeps the incoming source and marks a bare link as link", () => {
    const sp = (q: string) => new URLSearchParams(q);
    expect(shareTarget("ayzer", "az", sp("ref=instagram"))).toBe("/az/stores/ayzer?ref=instagram");
    expect(shareTarget("ayzer", "en", sp("utm_source=tiktok&x=1"))).toBe(
      "/en/stores/ayzer?utm_source=tiktok",
    );
    expect(shareTarget("ayzer", "ru", sp(""))).toBe("/ru/stores/ayzer?ref=link");
    expect(shareTarget("a b", "az", sp("ref=qr"))).toBe("/az/stores/a%20b?ref=qr");
  });
});

describe("referral source in the browser (#100)", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };

  it("reads ref before utm_source and ignores blank or long values", () => {
    expect(sourceFrom("?ref=ig&utm_source=tt")).toBe("ig");
    expect(sourceFrom("?utm_source=tt")).toBe("tt");
    expect(sourceFrom("?ref=%20")).toBeNull();
    expect(sourceFrom(`?ref=${"x".repeat(65)}`)).toBeNull();
    expect(sourceFrom("")).toBeNull();
  });

  it("reports a visit once per tab for the same store and source", () => {
    const store = memory();
    expect(rememberReferral({ slug: "a", source: "ig" }, store)).toBe(true);
    expect(rememberReferral({ slug: "a", source: "ig" }, store)).toBe(false);
    expect(rememberReferral({ slug: "a", source: "tt" }, store)).toBe(true);
    expect(readReferral(store)).toEqual({ slug: "a", source: "tt" });
  });

  it("gives the source only for the store the visitor came to", () => {
    const store = memory();
    rememberReferral({ slug: "a", source: "ig" }, store);
    expect(referralSourceFor("a", store)).toBe("ig");
    expect(referralSourceFor("b", store)).toBeNull();
  });

  it("treats broken storage as no referral", () => {
    const store = memory();
    store.setItem("jeparla:referral", "{not json");
    expect(readReferral(store)).toBeNull();
    expect(readReferral(null)).toBeNull();
  });
});

describe("sample referral statistics", () => {
  it("are all real zeros over every day of the window", () => {
    const stats = emptyReferralStats(30, new Date("2026-11-15T10:00:00Z"));
    expect(stats.daily).toHaveLength(30);
    expect(stats.from).toBe("2026-10-17");
    expect(stats.to).toBe("2026-11-15");
    expect(stats.visits + stats.whatsappClicks).toBe(0);
    expect(stats.daily.every((d) => d.visits === 0 && d.whatsappClicks === 0)).toBe(true);
    expect(stats.sources).toEqual([]);
  });
});
