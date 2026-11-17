import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientVideo, type VideoCut } from "./ambient-video";

type Callback = (entries: { isIntersecting: boolean }[]) => void;

const desktop: VideoCut = { mp4: "/d.mp4", webm: "/d.webm", poster: "/d.avif" };
const mobile: VideoCut = { mp4: "/m.mp4", webm: "/m.webm", poster: "/m.avif" };

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

let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
let load: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // jsdom has no media playback.
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sources = (c: HTMLElement) =>
  [...c.querySelectorAll("video source")].map((s) => s.getAttribute("src"));

describe("AmbientVideo", () => {
  it("requests nothing but a lazy poster before it comes near the viewport", () => {
    mockReducedMotion(false);
    mockObserver();
    const { container } = render(<AmbientVideo desktop={desktop} mobile={mobile} />);
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("preload", "none");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.hasAttribute("src")).toBe(false);
    expect(sources(container)).toEqual([]);
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
    expect(load).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("adds the sources near the viewport, plays while visible and pauses off-screen", () => {
    mockReducedMotion(false);
    const observers = mockObserver();
    const { container } = render(<AmbientVideo desktop={desktop} mobile={mobile} />);

    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(observers[0].disconnect).toHaveBeenCalled();
    // AV1 first, MP4 fallback, desktop cut before the phone cut.
    expect(sources(container)).toEqual(["/d.webm", "/d.mp4", "/m.webm", "/m.mp4"]);
    expect(load).toHaveBeenCalledTimes(1);

    const visibility = observers[1];
    act(() => visibility.cb([{ isIntersecting: true }]));
    expect(play).toHaveBeenCalledTimes(1);
    act(() => visibility.cb([{ isIntersecting: false }]));
    expect(pause).toHaveBeenCalled();
  });

  it("fades the video in only once it is actually playing", () => {
    mockReducedMotion(false);
    const observers = mockObserver();
    const { container } = render(<AmbientVideo desktop={desktop} mobile={mobile} />);
    act(() => observers[0].cb([{ isIntersecting: true }]));
    const video = container.querySelector("video")!;
    expect(video).not.toHaveAttribute("data-playing");
    act(() => {
      video.dispatchEvent(new Event("playing"));
    });
    expect(video).toHaveAttribute("data-playing");
  });

  it("keeps the poster and never requests the video under reduced motion", () => {
    mockReducedMotion(true);
    const observers = mockObserver();
    const { container } = render(<AmbientVideo desktop={desktop} mobile={mobile} />);
    expect(observers).toHaveLength(0);
    expect(sources(container)).toEqual([]);
    expect(container.querySelector("picture source")).toHaveAttribute("srcset", "/d.avif");
    expect(container.querySelector("img")).toHaveAttribute("src", "/m.avif");
    expect(play).not.toHaveBeenCalled();
  });

  it("loads the poster at once when the block is above the fold", () => {
    mockReducedMotion(false);
    mockObserver();
    const { container } = render(<AmbientVideo desktop={desktop} mobile={mobile} eager />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(sources(container)).toEqual([]);
  });

  it("offers a pause button that keeps the film paused when it scrolls back in", () => {
    mockReducedMotion(false);
    const observers = mockObserver();
    const labels = { pause: "Pause", play: "Play" };
    const { container, getByRole } = render(
      <AmbientVideo desktop={desktop} mobile={mobile} controls={labels} />,
    );
    act(() => observers[0].cb([{ isIntersecting: true }]));
    const button = getByRole("button", { name: "Pause" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector(".ambient-video")!.contains(button)).toBe(false);

    act(() => button.click());
    expect(pause).toHaveBeenCalled();
    expect(getByRole("button", { name: "Play" })).toHaveAttribute("aria-pressed", "true");

    play.mockClear();
    act(() => observers[1].cb([{ isIntersecting: true }]));
    expect(play).not.toHaveBeenCalled();

    act(() => getByRole("button", { name: "Play" }).click());
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("shows no pause button where the film never plays (reduced motion)", () => {
    mockReducedMotion(true);
    mockObserver();
    const { queryByRole } = render(
      <AmbientVideo
        desktop={desktop}
        mobile={mobile}
        controls={{ pause: "Pause", play: "Play" }}
      />,
    );
    expect(queryByRole("button")).toBeNull();
  });

  it("is decorative for assistive technology", () => {
    mockReducedMotion(false);
    mockObserver();
    const { container } = render(<AmbientVideo desktop={desktop} mobile={mobile} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
