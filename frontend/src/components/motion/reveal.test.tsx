import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./reveal";

type Callback = (entries: { isIntersecting: boolean }[]) => void;

function mockObserver() {
  const instances: { cb: Callback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  class FakeObserver {
    disconnect = vi.fn();
    observe = vi.fn();
    constructor(cb: Callback) {
      instances.push({ cb, disconnect: this.disconnect });
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return instances;
}

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce") }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Reveal", () => {
  it("stays hidden until it enters the viewport, then shows once", () => {
    mockReducedMotion(false);
    const observers = mockObserver();
    render(<Reveal>Kolleksiya</Reveal>);
    const el = screen.getByText("Kolleksiya");
    expect(el).toHaveAttribute("data-reveal", "hidden");

    observers[0].cb([{ isIntersecting: true }]);
    expect(el).toHaveAttribute("data-reveal", "shown");
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("shows immediately with prefers-reduced-motion", () => {
    mockReducedMotion(true);
    mockObserver();
    render(<Reveal>Kolleksiya</Reveal>);
    expect(screen.getByText("Kolleksiya")).toHaveAttribute("data-reveal", "shown");
  });

  it("passes the stagger index as a CSS variable", () => {
    mockReducedMotion(false);
    mockObserver();
    render(<Reveal index={3}>Üzük</Reveal>);
    expect(screen.getByText("Üzük").style.getPropertyValue("--reveal-index")).toBe("3");
  });
});
