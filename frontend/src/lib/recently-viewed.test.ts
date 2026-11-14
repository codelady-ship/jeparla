import { afterEach, describe, expect, it } from "vitest";
import { readRecent, RECENT_MAX, recordView } from "./recently-viewed";

describe("recently viewed", () => {
  afterEach(() => window.localStorage.clear());

  it("returns what was viewed before, newest first, without the current product", () => {
    expect(recordView(1)).toEqual([]);
    expect(recordView(2)).toEqual([1]);
    expect(recordView(3)).toEqual([2, 1]);
    // Viewing 1 again moves it to the front instead of duplicating it.
    expect(recordView(1)).toEqual([3, 2]);
    expect(readRecent()).toEqual([1, 3, 2]);
  });

  it("keeps at most RECENT_MAX ids and ignores broken storage", () => {
    for (let id = 1; id <= RECENT_MAX + 5; id++) recordView(id);
    expect(readRecent()).toHaveLength(RECENT_MAX);
    window.localStorage.setItem("jeparla-recently-viewed", "{not json");
    expect(readRecent()).toEqual([]);
  });
});
