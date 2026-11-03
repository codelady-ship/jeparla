import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import { HomeContent } from "./home-content";

function renderIn(locale: "az" | "en", messages: typeof az) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HomeContent />
    </NextIntlClientProvider>,
  );
}

describe("HomeContent", () => {
  it("shows the brand heading and the Azerbaijani tagline", () => {
    renderIn("az", az);
    expect(screen.getByRole("heading", { level: 1, name: "Jeparla" })).toBeInTheDocument();
    expect(screen.getByText(az.Home.tagline)).toBeInTheDocument();
  });

  it("switches copy with the locale", () => {
    renderIn("en", en);
    expect(screen.getByText(en.Home.tagline)).toBeInTheDocument();
  });
});
