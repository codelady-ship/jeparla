import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Autofill } from "@/lib/merchant/autofill";
import az from "../../../messages/az.json";
import { AutofillText, type AutofillOutcome } from "./autofill-text";

const t = az.Merchant.form.autofill;

const setup = (outcome: (a: Autofill) => AutofillOutcome) => {
  const onFill = vi.fn(outcome);
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

const paste = (value: string) =>
  fireEvent.change(screen.getByLabelText(t.label), { target: { value } });
const press = () => fireEvent.click(screen.getByRole("button", { name: t.fill }));

describe("fill the product form from text", () => {
  it("passes the reading to the form and says which fields it filled", async () => {
    const onFill = setup(() => ({ filled: ["name", "category", "metal"], kept: [] }));
    expect(screen.getByRole("button", { name: t.fill })).toBeDisabled();
    paste("Gümüş sırğa 925\n5,5 q\n180 AZN");
    press();
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
      await screen.findByText("Dolduruldu: ad, kateqoriya, metal. Addımlarda hər sahəni yoxlayın."),
    ).toBeTruthy();
  });

  it("lists the fields kept because the seller had already typed them", async () => {
    setup(() => ({ filled: ["weight"], kept: ["name", "description"] }));
    paste("Gümüş sırğa 925\n5,5 q");
    press();
    expect(
      await screen.findByText("Artıq yazdığınız sahələr dəyişdirilmədi: ad, təsvir."),
    ).toBeTruthy();
  });

  it("announces a repeated result again", async () => {
    setup(() => ({ filled: ["name"], kept: [] }));
    paste("Gümüş sırğa");
    press();
    const line = "Dolduruldu: ad. Addımlarda hər sahəni yoxlayın.";
    expect(await screen.findByText(line)).toBeTruthy();
    press();
    // The live region is emptied first, then gets the sentence again.
    expect(screen.queryByText(line)).toBeNull();
    expect(await screen.findByText(line)).toBeTruthy();
  });

  it("says so when the text has nothing it knows", async () => {
    setup(() => ({ filled: [], kept: [] }));
    paste("12");
    press();
    expect(await screen.findByText(t.nothing)).toBeTruthy();
  });

  it("shows a chevron so the closed panel looks like it opens", () => {
    setup(() => ({ filled: [], kept: [] }));
    const summary = screen.getByText(t.title).closest("summary")!;
    expect(summary.querySelectorAll("svg[aria-hidden]")).toHaveLength(2);
  });
});
