import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminMetalPrice } from "@/types/admin";
import en from "../../../messages/en.json";
import { MetalPrices } from "./metal-prices";

const GOLD: AdminMetalPrice = {
  metal: "GOLD",
  date: "2026-11-03",
  pricePerOunce: "7000.00",
  pricePerGram: "225.0555",
  previousPerOunce: "6990.00",
  change: "0.1",
  source: "CBAR",
  held: null,
};

function renderPrices() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MetalPrices rows={[GOLD]} />
    </NextIntlClientProvider>,
  );
}

async function openOverride() {
  fireEvent.click(screen.getByRole("button", { name: "Set by hand: Gold" }));
  return screen.findByRole("dialog");
}

afterEach(() => vi.unstubAllGlobals());

describe("MetalPrices override", () => {
  it("asks for a second confirmation above the 10% limit and sends nothing without it", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    renderPrices();
    const dialog = await openOverride();
    fireEvent.change(within(dialog).getByLabelText(en.Admin.prices.newPrice), {
      target: { value: "8000" },
    });
    expect(within(dialog).getByText("Change: +14.3%")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(en.Admin.reason.audit), {
      target: { value: "CBAR file had a typo" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Set by hand" }));
    expect(await within(dialog).findByText(en.Admin.errors.largeChange)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    fetch.mockResolvedValue(
      new Response(
        JSON.stringify({ pricePerOunce: "8000", pricePerGram: "257.2063", change: "14.3" }),
        { status: 200 },
      ),
    );
    fireEvent.click(within(dialog).getByLabelText(en.Admin.prices.confirmLarge));
    fireEvent.click(within(dialog).getByRole("button", { name: "Set by hand" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/admin/metal-prices/GOLD");
    expect(JSON.parse(init.body)).toEqual({
      pricePerOunce: "8000",
      reason: "CBAR file had a typo",
      confirmLarge: true,
    });
  });

  it("needs a reason for the audit log", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderPrices();
    const dialog = await openOverride();
    fireEvent.change(within(dialog).getByLabelText(en.Admin.prices.newPrice), {
      target: { value: "7010" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Set by hand" }));
    expect(await within(dialog).findByText(en.Admin.errors.reasonRequired)).toBeInTheDocument();
  });
});
