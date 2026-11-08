import { describe, expect, it } from "vitest";
import { frameAt, loadOrder, nearestLoaded } from "./frames";

describe("frameAt", () => {
  it("maps progress to a clamped frame index", () => {
    expect(frameAt(0, 100)).toBe(0);
    expect(frameAt(0.5, 101)).toBe(50);
    expect(frameAt(1, 100)).toBe(99);
    expect(frameAt(-1, 100)).toBe(0);
    expect(frameAt(2, 100)).toBe(99);
    expect(frameAt(0.5, 0)).toBe(-1);
  });
});

describe("loadOrder", () => {
  it("lists every frame once, ends first, then coarse to fine", () => {
    const order = loadOrder(10);
    expect(order.slice(0, 2)).toEqual([0, 9]);
    expect(order.slice(2, 3)).toEqual([8]);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(loadOrder(1)).toEqual([0]);
    expect(loadOrder(0)).toEqual([]);
  });
});

describe("nearestLoaded", () => {
  it("finds the closest loaded frame", () => {
    const loaded = [true, false, false, false, true];
    expect(nearestLoaded(1, loaded)).toBe(0);
    expect(nearestLoaded(3, loaded)).toBe(4);
    expect(nearestLoaded(2, [false, false, false])).toBe(-1);
  });
});
