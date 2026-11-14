import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollReveal } from "./scroll-reveal";

vi.mock("next/navigation", () => ({ usePathname: () => "/az" }));

type Callback = (entries: { isIntersecting: boolean; target: Element }[]) => void;
let observed: Element[] = [];
let trigger: Callback = () => {};

class FakeObserver {
  constructor(cb: Callback) {
    trigger = cb;
  }
  observe = (el: Element) => observed.push(el);
  unobserve = (el: Element) => (observed = observed.filter((x) => x !== el));
  disconnect = () => (observed = []);
}

function page() {
  document.body.innerHTML = `
    <main>
      <h2 id="top">On screen</h2>
      <h2 id="below">Further down</h2>
      <div data-reveal="hidden"><h2 id="inside">Inside a Reveal</h2></div>
      <h2 id="skip" data-no-reveal>Opted out</h2>
      <ul><li class="card-deferred"><img id="done" alt="" /><img id="later" alt="" /></li></ul>
    </main>`;
  const top = (id: string, y: number) =>
    (document.getElementById(id)!.getBoundingClientRect = () => ({ top: y }) as DOMRect);
  top("top", 100);
  top("below", 2000);
  top("inside", 2500);
  top("skip", 3000);
  Object.defineProperty(document.getElementById("done"), "complete", { value: true });
  Object.defineProperty(document.getElementById("later"), "complete", { value: false });
}

function motion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as typeof window.matchMedia;
}

describe("ScrollReveal", () => {
  beforeEach(() => {
    observed = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    page();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("hides only headings that start below the fold and shows them once in view", () => {
    motion(false);
    render(<ScrollReveal />);
    const below = document.getElementById("below")!;
    expect(below.getAttribute("data-reveal")).toBe("hidden");
    expect(document.getElementById("top")!.hasAttribute("data-reveal")).toBe(false);
    expect(document.getElementById("inside")!.hasAttribute("data-reveal")).toBe(false);
    expect(document.getElementById("skip")!.hasAttribute("data-reveal")).toBe(false);
    act(() => trigger([{ isIntersecting: true, target: below }]));
    expect(below.getAttribute("data-reveal")).toBe("shown");
    expect(observed).not.toContain(below);
  });

  it("fades in card images that are still loading, and marks them when they load", () => {
    motion(false);
    render(<ScrollReveal />);
    const done = document.getElementById("done")!;
    const later = document.getElementById("later")!;
    expect(done.hasAttribute("data-loaded")).toBe(true);
    expect(later.hasAttribute("data-fade")).toBe(true);
    expect(later.hasAttribute("data-loaded")).toBe(false);
    later.dispatchEvent(new Event("load"));
    expect(later.hasAttribute("data-loaded")).toBe(true);
  });

  it("changes nothing with reduced motion", () => {
    motion(true);
    render(<ScrollReveal />);
    expect(document.querySelectorAll("[data-reveal]")).toHaveLength(1); // the Reveal itself
    expect(document.querySelector("[data-fade]")).toBeNull();
  });
});
