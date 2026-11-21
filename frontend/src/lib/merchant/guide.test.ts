import { describe, expect, it } from "vitest";
import { dismissGuide, GUIDE_DISMISSED_KEY, isGuideDismissed } from "./guide";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const broken = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("seller guide dismissal", () => {
  it("is shown until dismissed, then stays dismissed", () => {
    const store = memory();
    expect(isGuideDismissed(store)).toBe(false);
    expect(dismissGuide(store)).toBe(true);
    expect(store.getItem(GUIDE_DISMISSED_KEY)).toBe("1");
    expect(isGuideDismissed(store)).toBe(true);
  });

  it("does not throw without storage or when storage is blocked", () => {
    expect(isGuideDismissed(null)).toBe(false);
    expect(dismissGuide(null)).toBe(false);
    expect(isGuideDismissed(broken)).toBe(false);
    expect(dismissGuide(broken)).toBe(false);
  });
});
