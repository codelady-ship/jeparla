import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import az from "../../../../messages/az.json";
import en from "../../../../messages/en.json";
import { CinematicHero } from "./cinematic-hero";
import { HERO_PHASES, heroCamera, phase } from "./hero-media";

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

describe("scene rail", () => {
  it("names the three models as scenes 1, 2 and 3 in every language", () => {
    mockMedia(true);
    for (const [locale, messages] of [
      ["az", az],
      ["en", en],
    ] as const) {
      const { unmount } = renderIn(locale, messages);
      const rail = screen.getByRole("list", { name: messages.Hero.scenesLabel });
      const items = [...rail.querySelectorAll("li")].map((li) => li.textContent);
      expect(items).toEqual([
        `01${messages.Hero.scenes.diamond}`,
        `02${messages.Hero.scenes.gold}`,
        `03${messages.Hero.scenes.silver}`,
      ]);
      unmount();
    }
  });
});

describe("heroCamera", () => {
  const models = [0.2, 0.5, 0.8];
  it("stays wide while the tigers turn and pulls back at the end", () => {
    expect(heroCamera(0.3, models).zoom).toBe(0);
    expect(heroCamera(1, models).zoom).toBe(0);
  });

  it("rests on model 1, 2 and 3 in turn", () => {
    expect(heroCamera(0.55, models)).toEqual({ zoom: 1, focus: 0.2 });
    expect(heroCamera(0.72, models)).toEqual({ zoom: 1, focus: 0.5 });
    expect(heroCamera(0.88, models)).toEqual({ zoom: 1, focus: 0.8 });
  });

  it("scenes follow each other without gaps", () => {
    const [s1, s2, s3] = HERO_PHASES.scenes;
    expect(s1[1]).toBe(s2[0]);
    expect(s2[1]).toBe(s3[0]);
  });
});

describe("phase", () => {
  it("maps track progress into a clamped 0..1 range", () => {
    expect(phase(0, [0.1, 0.5])).toBe(0);
    expect(phase(0.3, [0.1, 0.5])).toBeCloseTo(0.5);
    expect(phase(0.9, [0.1, 0.5])).toBe(1);
  });
});
