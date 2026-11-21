import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/formats";
import { PRODUCTS } from "@/lib/api/mock/fixtures";
import type { ProductSummary } from "@/types/api";
import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import { ProductCard } from "./product-card";
import { ProductGrid } from "./product-grid";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...rest }: ComponentProps<"a">) => <a href={String(href)} {...rest} />,
}));

const base: ProductSummary = {
  ...PRODUCTS[0],
  name: { az: "Uzuk", en: "Ring", ru: "Кольцо" },
  priceFrom: { amount: "1248.50", currency: "AZN" },
  weightGrams: "3.250",
  fineness: 585,
  metal: "GOLD",
  stockStatus: "IN_STOCK",
  verification: { seller: "VERIFIED", documents: "VERIFIED", expertise: "NONE" },
};

function renderIn(ui: React.ReactNode, locale: "az" | "en" = "az") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "az" ? az : en}
      formats={formats}
      timeZone="Asia/Baku"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("ProductCard", () => {
  it("shows name, store, metal, weight and the exact price", () => {
    renderIn(<ProductCard product={base} />);
    const link = screen.getByRole("link", { name: "Uzuk" });
    expect(link).toHaveAttribute("href", `/products/${base.slug}`);
    expect(screen.getByText(base.store.name)).toBeInTheDocument();
    expect(screen.getByText(/Qızıl 585/)).toBeInTheDocument();
    expect(screen.getByText(/1.?248,50/)).toBeInTheDocument();
    expect(screen.getByText(az.Product.verified)).toBeInTheDocument();
  });

  it("uses the locale for the name and labels", () => {
    renderIn(<ProductCard product={base} />, "en");
    expect(screen.getByRole("link", { name: "Ring" })).toBeInTheDocument();
    expect(screen.getByText(/Gold 585/)).toBeInTheDocument();
  });

  it("hides the verified badge unless seller and documents are verified", () => {
    renderIn(
      <ProductCard
        product={{ ...base, verification: { ...base.verification, documents: "PENDING" } }}
      />,
    );
    expect(screen.queryByText(az.Product.verified)).not.toBeInTheDocument();
  });

  it("labels AI images and stock status", () => {
    renderIn(
      <ProductCard
        product={{
          ...base,
          stockStatus: "OUT_OF_STOCK",
          images: [{ ...base.images[0], aiGenerated: true }],
        }}
      />,
    );
    expect(screen.getByText(az.Product.aiImage)).toBeInTheDocument();
    expect(screen.getByText(az.Product.stock.OUT_OF_STOCK)).toBeInTheDocument();
  });

  it("marks a product that has a video with an icon and never loads or plays the video (#117)", () => {
    const { container, unmount } = renderIn(
      <ProductCard
        product={{
          ...base,
          video: {
            url: "https://img.example/products/1/2/video/clip.mp4",
            contentType: "video/mp4",
            durationMs: 8000,
            width: 480,
            height: 600,
            aiGenerated: false,
          },
        }}
      />,
    );
    expect(screen.getByText(az.Product.hasVideo)).toBeInTheDocument();
    expect(container.querySelector("video, source")).toBeNull();
    expect(container.innerHTML).not.toContain("clip.mp4");
    unmount();

    renderIn(<ProductCard product={{ ...base, video: undefined }} />);
    expect(screen.queryByText(az.Product.hasVideo)).not.toBeInTheDocument();
  });

  it("shows a bijouterie badge and the material instead of metal and fineness (#128)", () => {
    renderIn(
      <ProductCard
        product={{
          ...base,
          materialKind: "FASHION",
          material: "BEADS",
          metal: null,
          fineness: null,
          weightGrams: null,
          verification: { seller: "VERIFIED", documents: "NONE", expertise: "NONE" },
        }}
      />,
    );
    expect(screen.getByText(az.Product.fashionBadge)).toBeInTheDocument();
    expect(screen.getByText(az.Product.material.BEADS)).toBeInTheDocument();
    expect(screen.queryByText(/Qızıl/)).not.toBeInTheDocument();
    expect(screen.queryByText(az.Product.verified)).not.toBeInTheDocument();
  });

  it("toggles favorite with a pressed state and a changing label", () => {
    renderIn(<ProductCard product={base} />);
    const fav = screen.getByRole("button", { name: az.Product.favoriteAdd });
    expect(fav).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(fav);
    const on = screen.getByRole("button", { name: az.Product.favoriteRemove });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem("jeparla-favorites")!)).toEqual([base.id]);
  });
});

describe("ProductGrid", () => {
  it("renders one list item per product", () => {
    renderIn(<ProductGrid products={PRODUCTS.slice(0, 6)} />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
  });

  it("renders the empty slot when there are no products", () => {
    renderIn(<ProductGrid products={[]} empty={<p>bos</p>} />);
    expect(screen.getByText("bos")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
