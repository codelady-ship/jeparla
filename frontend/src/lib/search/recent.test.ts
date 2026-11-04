import { beforeEach, describe, expect, it } from "vitest";
import { addRecent, clearRecent, readRecent } from "./recent";

beforeEach(() => localStorage.clear());

describe("recent searches", () => {
  it("keeps the newest first, without duplicates, at most 5", () => {
    for (const q of ["a", "b", "c", "d", "e", "f"]) addRecent(q);
    expect(readRecent()).toEqual(["f", "e", "d", "c", "b"]);
    addRecent("C");
    expect(readRecent()).toEqual(["C", "f", "e", "d", "b"]);
  });

  it("ignores empty queries and corrupt storage", () => {
    addRecent("   ");
    expect(readRecent()).toEqual([]);
    localStorage.setItem("jeparla-recent-searches", "{bad");
    expect(readRecent()).toEqual([]);
  });

  it("clears", () => {
    addRecent("x");
    clearRecent();
    expect(readRecent()).toEqual([]);
  });
});
