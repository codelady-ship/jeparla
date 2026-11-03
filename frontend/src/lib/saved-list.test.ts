import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSavedList } from "./saved-list";

beforeEach(() => localStorage.clear());

describe("createSavedList", () => {
  it("toggles ids and persists them", () => {
    const list = createSavedList("t1");
    expect(list.toggle(5)).toBe(true);
    expect(list.has(5)).toBe(true);
    expect(JSON.parse(localStorage.getItem("t1")!)).toEqual([5]);
    expect(list.toggle(5)).toBe(false);
    expect(list.get()).toEqual([]);
  });

  it("returns the same snapshot until something changes", () => {
    const list = createSavedList("t2");
    const a = list.get();
    expect(list.get()).toBe(a);
    list.toggle(1);
    expect(list.get()).not.toBe(a);
  });

  it("respects the maximum", () => {
    const list = createSavedList("t3", 2);
    list.toggle(1);
    list.toggle(2);
    expect(list.toggle(3)).toBe(false);
    expect(list.get()).toEqual([1, 2]);
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem("t4", "{not json");
    expect(createSavedList("t4").get()).toEqual([]);
    localStorage.setItem("t5", JSON.stringify(["x", 2, 1.5]));
    expect(createSavedList("t5").get()).toEqual([2]);
  });

  it("notifies subscribers", () => {
    const list = createSavedList("t6");
    const cb = vi.fn();
    const off = list.subscribe(cb);
    list.toggle(9);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    list.toggle(9);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
