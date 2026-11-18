import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { formats } from "@/i18n/formats";
import { LATEST_METAL_PRICES, PRODUCTS } from "@/lib/api/mock/fixtures";
import { formatPrice } from "@/lib/money";
import { product as productLd } from "@/lib/seo/json-ld";
import type { Product, Variant, VariantPriceBreakdown } from "@/types/api";
import az from "../../../messages/az.json";
import { PriceBreakdownBlock } from "./price-breakdown";

function renderBlock(product: Product) {
  return render(
    <NextIntlClientProvider locale="az" messages={az} formats={formats} timeZone="Asia/Baku">
      <PriceBreakdownBlock
        product={product}
        variants={product.variants.map((v) => ({ id: v.id, label: v.sku }))}
        metalPrices={LATEST_METAL_PRICES}
      />
    </NextIntlClientProvider>,
  );
}

/** The demo mock sends the breakdown as the backend builds it (contract-tested). */
const breakdownOf = (v: Variant): VariantPriceBreakdown => v.priceBreakdown!;

const linked = PRODUCTS.find((p) => p.pricingMode === "METAL_LINKED" && p.stones.length > 0)!;
const fixed = PRODUCTS.find((p) => p.pricingMode === "FIXED")!;

describe("PriceBreakdownBlock (#104)", () => {
  it("is a details/summary block, so it works without JavaScript", () => {
    renderBlock(linked);
    const block = screen.getByTestId("price-breakdown");
    expect(block.tagName).toBe("DETAILS");
    expect(within(block).getByText(az.Pdp.breakdown.title).closest("summary")).not.toBeNull();
  });

  it("shows labor and the store share as two lines when the store chose so", () => {
    const v = linked.variants[0];
    const b = { ...breakdownOf(v), laborSeparate: true };
    renderBlock({ ...linked, variants: [{ ...v, priceBreakdown: b }] });
    const block = screen.getByTestId("price-breakdown");
    expect(within(block).queryByText(az.Pdp.breakdown.laborAndShare)).not.toBeInTheDocument();
    if (b.labor) expect(within(block).getByText(az.Pdp.breakdown.labor)).toBeInTheDocument();
    if (b.markup) expect(within(block).getByText(az.Pdp.breakdown.markup)).toBeInTheDocument();
  });

  it("shows metal, labor with store share on one line, the stone from the seller and the PDP total", () => {
    const v = linked.variants[0];
    const p = linked;
    expect(breakdownOf(v).stone).not.toBeNull();
    renderBlock(p);
    const block = screen.getByTestId("price-breakdown");
    expect(within(block).getByText(az.Pdp.breakdown.metal)).toBeInTheDocument();
    expect(within(block).getByText(az.Pdp.breakdown.laborAndShare)).toBeInTheDocument();
    expect(within(block).getByText(az.Pdp.breakdown.fromSeller)).toBeInTheDocument();
    // The total equals the price on the page and the JSON-LD offer.
    const offer = (productLd(p, "az") as { offers: { price: string } }).offers.price;
    const total = within(block).getByText(az.Pdp.breakdown.total).closest("tr")!;
    expect(total.querySelector("td")!.textContent).toBe(formatPrice(offer, "az"));
    expect(total.querySelector("td")!.textContent).toBe(formatPrice(v.price.amount, "az"));
    expect(within(block).getByRole("link", { name: /AMB/ })).toHaveAttribute(
      "href",
      expect.stringContaining("cbar.az"),
    );
  });

  it("FIXED: only today's estimated metal value and the total, no invented labor", () => {
    renderBlock(fixed);
    const block = screen.getByTestId("price-breakdown");
    expect(within(block).getByText(az.Pdp.breakdown.metalToday)).toBeInTheDocument();
    expect(within(block).queryByText(az.Pdp.breakdown.laborAndShare)).not.toBeInTheDocument();
    expect(
      within(block).getByText(az.Pdp.breakdown.total).closest("tr")!.querySelector("td")!
        .textContent,
    ).toBe(formatPrice(fixed.variants[0].price.amount, "az"));
    expect(within(block).getByText(az.Pdp.breakdown.note)).toBeInTheDocument();
  });

  it("notes a clamped price", () => {
    const v = linked.variants[0];
    const b = { ...breakdownOf(v), clamped: "MIN" as const };
    renderBlock({ ...linked, variants: [{ ...v, priceBreakdown: b }] });
    expect(screen.getByText(az.Pdp.breakdown.clamped.MIN)).toBeInTheDocument();
  });

  it("is not shown for bijouterie (#128)", () => {
    renderBlock({ ...fixed, materialKind: "FASHION", metal: null, material: "BEADS" });
    expect(screen.queryByTestId("price-breakdown")).not.toBeInTheDocument();
  });
});
