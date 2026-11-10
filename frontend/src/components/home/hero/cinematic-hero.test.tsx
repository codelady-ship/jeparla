import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import az from "../../../../messages/az.json";
import en from "../../../../messages/en.json";
import { CinematicHero } from "./cinematic-hero";
import { phase } from "./hero-media";
import { afterLoad } from "./hero-motion";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...rest }: Omit<ComponentProps<"a">, "href"> & { href: string }) => (
    <a href={href} {...rest} />
  ),
}));

function renderIn(locale: "az" | "en", messages: typeof az) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CinematicHero />
    </NextIntlClientProvider>,
  );
}

function mockMedia(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  // jsdom has no media playback or canvas.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CinematicHero", () => {
  it("renders one slogan and both calls to action as real HTML", () => {
    mockMedia(true);
    renderIn("az", az);
    expect(screen.getByRole("heading", { level: 1, name: az.Hero.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: az.Hero.ctaCollection })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("link", { name: az.Hero.ctaStores })).toHaveAttribute(
      "href",
      "/stores",
    );
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("describes the scene for screen readers and hides the decorative brand line", () => {
    mockMedia(true);
    const { container } = renderIn("en", en);
    expect(screen.getByRole("img", { name: en.Hero.scene })).toBeInTheDocument();
    const brand = container.querySelector("[data-hero-brand]");
    expect(brand).toHaveTextContent("Jeparla");
    expect(brand).toHaveAttribute("aria-hidden", "true");
  });

  it("plays a muted inline entrance video with a phone and a desktop cut", () => {
    mockMedia(false);
    const { container } = renderIn("az", az);
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(video.hasAttribute("loop")).toBe(false);
    const sources = [...video.querySelectorAll("source")].map((s) => s.getAttribute("src"));
    expect(sources).toEqual(["/hero/enter-desktop.mp4", "/hero/enter-mobile.mp4"]);
  });

  it("goes static and shows the copy at once under reduced motion", async () => {
    mockMedia(true);
    const { container } = renderIn("az", az);
    const hero = screen.getByRole("region", { name: az.Hero.label });
    await waitFor(() => expect(hero).toHaveAttribute("data-mode", "static"));
    expect(container.querySelector(".hero")).toHaveClass("is-revealed");
  });

  it("reveals the copy when the entrance video ends", async () => {
    mockMedia(false);
    const { container } = renderIn("az", az);
    const stage = container.querySelector(".hero")!;
    await waitFor(() =>
      expect(screen.getByRole("region", { name: az.Hero.label })).toHaveAttribute(
        "data-mode",
        "motion",
      ),
    );
    expect(stage).not.toHaveClass("is-revealed");
    container.querySelector("video")!.dispatchEvent(new Event("ended"));
    expect(stage).toHaveClass("is-revealed");
  });
});

describe("afterLoad", () => {
  it("waits for the load event while the page is still loading", () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    vi.stubGlobal("requestIdleCallback", (cb: () => void) => (cb(), 1));
    const start = vi.fn();
    afterLoad(start);
    expect(start).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    expect(start).toHaveBeenCalledOnce();
  });

  it("does not start after it was cancelled", () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const start = vi.fn();
    afterLoad(start)();
    window.dispatchEvent(new Event("load"));
    expect(start).not.toHaveBeenCalled();
  });
});

describe("phase", () => {
  it("maps track progress into a clamped 0..1 range", () => {
    expect(phase(0, [0.1, 0.5])).toBe(0);
    expect(phase(0.3, [0.1, 0.5])).toBeCloseTo(0.5);
    expect(phase(0.9, [0.1, 0.5])).toBe(1);
  });
});
