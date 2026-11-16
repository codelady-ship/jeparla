import { describe, expect, it } from "vitest";
import { isNoEdit, NO_EDIT, plan, turn } from "./photo-edit";

describe("photo edit plan", () => {
  it("keeps a small photo as it is", () => {
    expect(plan(1200, 800, NO_EDIT)).toEqual({
      rotated: { width: 1200, height: 800 },
      crop: { x: 0, y: 0, width: 1200, height: 800 },
      out: { width: 1200, height: 800 },
    });
  });

  it("swaps the sides for a quarter turn", () => {
    const p = plan(1200, 800, { rotate: 90, crop: "original" });
    expect(p.rotated).toEqual({ width: 800, height: 1200 });
    expect(p.out).toEqual({ width: 800, height: 1200 });
  });

  it("cuts a centered square", () => {
    expect(plan(1200, 800, { rotate: 0, crop: "square" }).crop).toEqual({
      x: 200,
      y: 0,
      width: 800,
      height: 800,
    });
    expect(plan(800, 1200, { rotate: 180, crop: "square" }).crop).toEqual({
      x: 0,
      y: 200,
      width: 800,
      height: 800,
    });
  });

  it("cuts 4:5 from a wide and from a tall photo", () => {
    expect(plan(1000, 1000, { rotate: 0, crop: "portrait" }).crop).toEqual({
      x: 100,
      y: 0,
      width: 800,
      height: 1000,
    });
    expect(plan(800, 2000, { rotate: 0, crop: "portrait" }).crop).toEqual({
      x: 0,
      y: 500,
      width: 800,
      height: 1000,
    });
    // A landscape phone photo turned upright, then 4:5.
    const p = plan(4000, 3000, { rotate: 270, crop: "portrait" });
    expect(p.rotated).toEqual({ width: 3000, height: 4000 });
    expect(p.crop).toEqual({ x: 0, y: 125, width: 3000, height: 3750 });
    expect(p.out).toEqual({ width: 1920, height: 2400 });
  });

  it("scales down to the longest side and never enlarges", () => {
    expect(plan(6000, 4000, NO_EDIT).out).toEqual({ width: 2400, height: 1600 });
    expect(plan(300, 200, NO_EDIT, 2400).out).toEqual({ width: 300, height: 200 });
    expect(plan(6000, 4000, NO_EDIT, 300).out).toEqual({ width: 300, height: 200 });
  });

  it("turns in 90 degree steps both ways", () => {
    expect(turn(NO_EDIT, 1).rotate).toBe(90);
    expect(turn(NO_EDIT, -1).rotate).toBe(270);
    expect(turn({ rotate: 270, crop: "square" }, 1)).toEqual({ rotate: 0, crop: "square" });
    expect(isNoEdit(NO_EDIT)).toBe(true);
    expect(isNoEdit(turn(turn(turn(turn(NO_EDIT, 1), 1), 1), 1))).toBe(true);
    expect(isNoEdit({ rotate: 0, crop: "square" })).toBe(false);
  });
});
