import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TiltRing } from "./tilt-ring";

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce") }));
}

let frames: FrameRequestCallback[] = [];
const flush = (n = 30) => {
  for (let i = 0; i < n && frames.length; i++) {
    const run = frames;
    frames = [];
    run.forEach((f) => f(0));
  }
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function move(x: number, y: number) {
  window.dispatchEvent(
    Object.assign(new Event("pointermove"), { clientX: x, clientY: y, pointerType: "mouse" }),
  );
}

describe("TiltRing", () => {
  it("is decorative", () => {
    mockReducedMotion(false);
    const { container } = render(<TiltRing />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[tabindex]")).toBeNull();
  });

  it("turns toward the pointer", () => {
    mockReducedMotion(false);
    const { container } = render(<TiltRing />);
    const ring = container.querySelector<HTMLElement>("[data-tilt]")!;
    expect(ring.style.transform).toBe("");

    move(900, 100);
    flush();
    const right = ring.style.transform;
    expect(right).toMatch(/rotateX\(-?[\d.]+deg\) rotateY\([\d.]+deg\)/);

    move(-900, 100);
    flush();
    expect(ring.style.transform).toMatch(/rotateY\(-\d/);
    expect(ring.style.transform).not.toBe(right);
  });

  it("stays still under reduced motion", () => {
    mockReducedMotion(true);
    const { container } = render(<TiltRing />);
    move(900, 100);
    flush();
    expect(container.querySelector<HTMLElement>("[data-tilt]")!.style.transform).toBe("");
    expect(frames).toHaveLength(0);
  });
});
