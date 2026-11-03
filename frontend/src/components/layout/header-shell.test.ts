import { describe, expect, it } from "vitest";
import { shouldHide } from "./header-shell";

describe("shouldHide", () => {
  const h = 64;
  it("hides when scrolling down past twice the header height", () => {
    expect(shouldHide(200, 260, h, false)).toBe(true);
  });
  it("shows when scrolling up", () => {
    expect(shouldHide(260, 200, h, false)).toBe(false);
  });
  it("stays visible near the top", () => {
    expect(shouldHide(40, 100, h, false)).toBe(false);
  });
  it("stays visible while something in the header has focus", () => {
    expect(shouldHide(200, 260, h, true)).toBe(false);
  });
});
