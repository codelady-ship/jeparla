import { describe, expect, it } from "vitest";
import { allSelected, bulkTargets, toggled } from "./selection";

const drafts = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe("bulkTargets", () => {
  it("works on every draft in view when nothing is ticked", () => {
    expect(bulkTargets(drafts, new Set())).toEqual({ rows: drafts, selection: false });
  });

  it("works only on the ticked drafts", () => {
    expect(bulkTargets(drafts, new Set([3, 1]))).toEqual({
      rows: [{ id: 1 }, { id: 3 }],
      selection: true,
    });
  });

  it("ignores ticks on rows that are no longer drafts in view", () => {
    expect(bulkTargets(drafts, new Set([9]))).toEqual({ rows: drafts, selection: false });
    expect(bulkTargets(drafts, new Set([9, 2])).rows).toEqual([{ id: 2 }]);
  });
});

describe("toggled and allSelected", () => {
  it("adds and removes one id without changing the old set", () => {
    const start = new Set([1]);
    expect([...toggled(start, 2, true)]).toEqual([1, 2]);
    expect([...toggled(start, 1, false)]).toEqual([]);
    expect([...start]).toEqual([1]);
  });

  it("is all selected only with every id and at least one", () => {
    expect(allSelected(new Set([1, 2, 3]), [1, 2, 3])).toBe(true);
    expect(allSelected(new Set([1, 2]), [1, 2, 3])).toBe(false);
    expect(allSelected(new Set(), [])).toBe(false);
  });
});
