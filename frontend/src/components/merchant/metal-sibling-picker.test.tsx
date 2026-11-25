import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetalSiblings } from "@/lib/merchant/metal-sibling";
import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import { MetalSiblingPicker } from "./metal-sibling-picker";

const t = az.Merchant.form.metalSibling;
const names = { GOLD: "Qızıl", SILVER: "Gümüş", PLATINUM: "Platin", PALLADIUM: "Palladium" };
const initial: MetalSiblings = {
  siblingId: null,
  options: [
    { id: 8, name: "Xəzər üzük", metal: "SILVER", linkedElsewhere: false },
    { id: 9, name: "Şəki sırğa", metal: "SILVER", linkedElsewhere: true },
  ],
};

const renderIn = (value: MetalSiblings) =>
  render(
    <NextIntlClientProvider locale="az" messages={az} timeZone="Asia/Baku">
      <MetalSiblingPicker productId={7} initial={value} metalNames={names} />
    </NextIntlClientProvider>,
  );

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("MetalSiblingPicker", () => {
  it("links the chosen product and says so", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...initial, siblingId: 8 }), { status: 200 }),
    );
    renderIn(initial);
    const select = screen.getByLabelText(t.label);
    expect(
      screen.getByRole("option", { name: `Şəki sırğa · Gümüş · ${t.linkedElsewhere}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.save })).toBeDisabled();
    fireEvent.change(select, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    expect(await screen.findByText(t.saved)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/merchant/products/7/metal-sibling",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ siblingId: 8 }) }),
    );
    expect(screen.getByRole("button", { name: t.save })).toBeDisabled();
  });

  it("unlinks and shows a plain error when the API fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    renderIn({ ...initial, siblingId: 8 });
    fireEvent.change(screen.getByLabelText(t.label), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    expect(await screen.findByText(t.error)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/merchant/products/7/metal-sibling",
      expect.objectContaining({ body: JSON.stringify({ siblingId: null }) }),
    );
  });

  it("is left out when the store has nothing to link", () => {
    const { container } = renderIn({ siblingId: null, options: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("has every text in az, en and ru", () => {
    for (const m of [en, ru]) {
      expect(Object.keys(m.Merchant.form.metalSibling).sort()).toEqual(Object.keys(t).sort());
    }
  });
});
