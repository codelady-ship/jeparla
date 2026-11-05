import { describe, expect, it } from "vitest";
import { Timeline, toStyle, trackProgress } from "./scrub";

const a = { id: "a" };
const b = { id: "b" };

describe("Timeline.resolve", () => {
  it("interpolates a fromTo and holds the end value", () => {
    const tl = new Timeline<typeof a>().fromTo(a, { xPercent: -100 }, { xPercent: 0 }, 1, 2);
    expect(tl.resolve(0).get(a)).toEqual({ xPercent: -100 });
    expect(tl.resolve(2).get(a)).toEqual({ xPercent: -50 });
    expect(tl.resolve(5).get(a)).toEqual({ xPercent: 0 });
    expect(tl.duration).toBe(3);
  });

  it("starts a `to` from the value left by the previous tween", () => {
    const tl = new Timeline<typeof a>().to(a, { opacity: 0.6 }, 0, 1).to(a, { opacity: 0 }, 2, 1);
    expect(tl.resolve(0.5).get(a)?.opacity).toBeCloseTo(0.8);
    expect(tl.resolve(1.5).get(a)?.opacity).toBeCloseTo(0.6);
    expect(tl.resolve(2.5).get(a)?.opacity).toBeCloseTo(0.3);
  });

  it("staggers several targets", () => {
    const tl = new Timeline<typeof a>().fromTo([a, b], { alpha: 0 }, { alpha: 1 }, 0, 1, 0.5);
    expect(tl.resolve(1).get(a)?.alpha).toBe(1);
    expect(tl.resolve(1).get(b)?.alpha).toBeCloseTo(0.5);
  });
});

describe("toStyle", () => {
  it("writes only what is animated and hides at zero alpha", () => {
    expect(toStyle({ alpha: 0 })).toEqual({ opacity: "0", visibility: "hidden" });
    expect(toStyle({ opacity: 0.5 })).toEqual({ opacity: "0.5" });
    expect(toStyle({ xPercent: -34, scale: 0.3 }).transform).toBe(
      "translate(-34%, 0%) translate(0px, 0px) scale(0.3)",
    );
  });
});

describe("trackProgress", () => {
  it("maps the sticky track position to 0..1", () => {
    expect(trackProgress(0, 3000, 1000)).toBe(0);
    expect(trackProgress(-1000, 3000, 1000)).toBe(0.5);
    expect(trackProgress(-5000, 3000, 1000)).toBe(1);
    expect(trackProgress(200, 3000, 1000)).toBe(0);
    expect(trackProgress(0, 800, 1000)).toBe(0);
  });
});
