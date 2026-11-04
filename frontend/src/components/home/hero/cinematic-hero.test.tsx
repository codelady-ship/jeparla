import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import az from "../../../../messages/az.json";
import en from "../../../../messages/en.json";
import { CinematicHero } from "./cinematic-hero";

type Href = string | { pathname: string; query?: Record<string, string> };
const toUrl = (h: Href) =>
  typeof h === "string" ? h : h.pathname + "?" + new URLSearchParams(h.query).toString();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...rest }: Omit<ComponentProps<"a">, "href"> & { href: Href }) => (
    <a href={toUrl(href)} {...rest} />
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@/assets/hero/white-tiger.jpg", () => ({
  default: { src: "/w.jpg", width: 1, height: 1 },
}));
vi.mock("@/assets/hero/snow-leopard.jpg", () => ({
  default: { src: "/s.jpg", width: 1, height: 1 },
}));
vi.mock("@/assets/hero/gold-tiger.jpg", () => ({
  default: { src: "/g.jpg", width: 1, height: 1 },
}));

function renderIn(locale: "az" | "en", messages: typeof az) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CinematicHero />
    </NextIntlClientProvider>,
  );
}

function mockReducedMotion(reduce: boolean) {
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

afterEach(() => vi.unstubAllGlobals());

describe("CinematicHero", () => {
  it("renders the headline and both calls to action as real HTML", () => {
    mockReducedMotion(true);
    renderIn("az", az);
    expect(
      screen.getByRole("heading", { level: 1, name: az.Hero.intro.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: az.Hero.ctaCollection })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("link", { name: az.Hero.ctaStores })).toHaveAttribute(
      "href",
      "/stores",
    );
  });

  it("shows three metals, each linking to the filtered catalog", () => {
    mockReducedMotion(true);
    renderIn("en", en);
    const silver = screen.getByText(en.Hero.panels.silver.name, { selector: "figcaption span" });
    const links = within(silver.closest("figure")!).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute("href", "/products?metal=SILVER&category=sirgalar");
    expect(links[0]).toHaveAccessibleName("Silver: Earrings");
    const diamond = screen.getByText(en.Hero.panels.diamond.name, { selector: "figcaption span" });
    expect(within(diamond.closest("figure")!).getAllByRole("link")[0]).toHaveAttribute(
      "href",
      "/products?minCarat=0.01&category=sirgalar",
    );
  });

  it("stays static under reduced motion and does not load the animation", async () => {
    mockReducedMotion(true);
    renderIn("az", az);
    const hero = screen.getByRole("region", { name: az.Hero.label });
    await waitFor(() => expect(hero).toHaveAttribute("data-mode", "static"));
  });

  it("credits the photographers", () => {
    mockReducedMotion(true);
    renderIn("az", az);
    expect(screen.getByText(/Tommaso Ubezio/)).toBeInTheDocument();
  });
});
