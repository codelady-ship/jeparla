import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import az from "../../../messages/az.json";
import { AutofillText } from "./autofill-text";

const t = az.Merchant.form.autofill;

const setup = () => {
  const onFill = vi.fn();
  render(
    <NextIntlClientProvider locale="az" messages={az} timeZone="Asia/Baku">
      <AutofillText
        categories={[{ value: "sirgalar", label: "Sırğalar" }]}
        finenesses={[{ value: "5", metal: "SILVER", fineness: 925 }]}
        onFill={onFill}
      />
    </NextIntlClientProvider>,
  );
  return onFill;
};

describe("fill the product form from text", () => {
  it("fills the fields the text names and says which", () => {
    const onFill = setup();
    expect(screen.getByRole("button", { name: t.fill })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.label), {
      target: { value: "Gümüş sırğa 925\n5,5 q\n180 AZN" },
    });
    fireEvent.click(screen.getByRole("button", { name: t.fill }));
    expect(onFill).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Gümüş sırğa 925",
        category: "sirgalar",
        metal: "SILVER",
        fineness: "5",
        weight: "5.5",
        price: "180",
      }),
    );
    expect(
      screen.getByText(/^Dolduruldu: ad, kateqoriya, metal, əyar, çəki, qiymət\./),
    ).toBeTruthy();
  });

  it("changes nothing when the text has nothing it knows", () => {
    const onFill = setup();
    fireEvent.change(screen.getByLabelText(t.label), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: t.fill }));
    expect(onFill).not.toHaveBeenCalled();
    expect(screen.getByText(t.nothing)).toBeTruthy();
  });
});
