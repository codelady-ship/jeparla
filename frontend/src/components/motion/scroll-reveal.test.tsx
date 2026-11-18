import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollReveal } from "./scroll-reveal";

vi.mock("next/navigation", () => ({ usePathname: () => "/az" }));

type Entry = {
  isIntersecting: boolean;
  target: Element;
  boundingClientRect: { height: number; bottom: number };
};
type Callback = (entries: Entry[]) => void;

/** Observers in creation order: [0] reveals on scroll, [1] probes the first position. */
let observers: FakeObserver[] = [];

class FakeObserver {
  observed: Element[] = [];
  constructor(public cb: Callback) {
    observers.push(this);
  }
  observe = (el: Element) => this.observed.push(el);
  unobserve = (el: Element) => (this.observed = this.observed.filter((x) => x !== el));
  disconnect = () => (this.observed = []);
}

const at = (target: Element, isIntersecting: boolean, bottom = 2100): Entry => ({
  isIntersecting,
  target,
  boundingClientRect: { height: 40, bottom },
});

function page() {
  document.body.innerHTML = `
    <main>
      <h2 id="top">On screen</h2>
      <h2 id="below">Further down</h2>
      <h2 id="past">Scrolled past</h2>
      <div data-reveal="hidden"><h2 id="inside">Inside a Reveal</h2></div>
      <h2 id="skip" data-no-reveal>Opted out</h2>
      <ul><li class="card-deferred"><img id="done" alt="" /><img id="later" alt="" /></li></ul>
    </main>`;
  Object.defineProperty(document.getElementById("done"), "complete", { value: true });
  Object.defineProperty(document.getElementById("later"), "complete", { value: false });
}

function motion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as typeof window.matchMedia;
}

const $ = (id: string) => document.getElementById(id)!;

describe("ScrollReveal", () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    page();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("hides only headings that start below the fold and shows them once in view", () => {
    motion(false);
    render(<ScrollReveal />);
    const [reveal, probe] = observers;
    // Headings inside a <Reveal> or opted out are never probed.
    expect(probe.observed.map((el) => el.id)).toEqual(["top", "below", "past"]);
    // Nothing is hidden before the observer has reported (no layout read at hydration).
    expect(document.querySelectorAll("h2[data-reveal]")).toHaveLength(0);

    act(() => probe.cb([at($("top"), true), at($("below"), false), at($("past"), false, -200)]));
    expect($("below").getAttribute("data-reveal")).toBe("hidden");
    expect($("top").hasAttribute("data-reveal")).toBe(false);
    expect($("past").hasAttribute("data-reveal")).toBe(false);
    expect($("inside").hasAttribute("data-reveal")).toBe(false);
    expect($("skip").hasAttribute("data-reveal")).toBe(false);
    expect(probe.observed).toHaveLength(0);
    expect(reveal.observed).toEqual([$("below")]);

    act(() => reveal.cb([at($("below"), true)]));
    expect($("below").getAttribute("data-reveal")).toBe("shown");
    expect(reveal.observed).not.toContain($("below"));
  });

  it("fades in card images that are still loading, and marks them when they load", () => {
    motion(false);
    render(<ScrollReveal />);
    const done = $("done");
    const later = $("later");
    expect(done.hasAttribute("data-loaded")).toBe(true);
    expect(later.hasAttribute("data-fade")).toBe(true);
    expect(later.hasAttribute("data-loaded")).toBe(false);
    later.dispatchEvent(new Event("load"));
    expect(later.hasAttribute("data-loaded")).toBe(true);
  });

  it("changes nothing with reduced motion", () => {
    motion(true);
    render(<ScrollReveal />);
    expect(observers).toHaveLength(0);
    expect(document.querySelectorAll("[data-reveal]")).toHaveLength(1); // the Reveal itself
    expect(document.querySelector("[data-fade]")).toBeNull();
  });
});
