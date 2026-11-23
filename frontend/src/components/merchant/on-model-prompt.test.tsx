import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { onModelPrompt } from "@/lib/merchant/on-model";
import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import { AiReviewBadge } from "./ai-review-badge";
import { OnModelPrompt } from "./on-model-prompt";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const t = az.Merchant.form.onModel;

const renderIn = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="az" messages={az} timeZone="Asia/Baku">
      {ui}
    </NextIntlClientProvider>,
  );

describe("onModelPrompt (#316)", () => {
  it("says the automatic job started only for a new product", () => {
    expect(
      onModelPrompt({ place: "photos", autoTryOn: true, creating: true, productId: null }),
    ).toEqual({ text: "autoNew", href: null });
    expect(onModelPrompt({ place: "done", autoTryOn: true, creating: true, productId: 9 })).toEqual(
      {
        text: "doneAuto",
        href: "/merchant/products/9/ai-studio",
      },
    );
    // An edit adds photos to a product that has one: the backend queues nothing by itself.
    expect(
      onModelPrompt({ place: "photos", autoTryOn: true, creating: false, productId: 9 }),
    ).toEqual({ text: "studio", href: "/merchant/products/9/ai-studio" });
  });

  it("sends the seller to AI Studio when nothing starts by itself", () => {
    expect(
      onModelPrompt({ place: "photos", autoTryOn: false, creating: true, productId: null }),
    ).toEqual({ text: "afterSave", href: null });
    expect(
      onModelPrompt({ place: "done", autoTryOn: false, creating: true, productId: 4 }),
    ).toEqual({
      text: "doneManual",
      href: "/merchant/products/4/ai-studio",
    });
  });

  it("has every text in az, en and ru", () => {
    for (const m of [az, en, ru]) {
      const o = m.Merchant.form.onModel;
      for (const key of [
        "title",
        "autoNew",
        "afterSave",
        "studio",
        "doneAuto",
        "doneManual",
        "open",
      ])
        expect(o[key as keyof typeof o]).toBeTruthy();
      expect(m.Merchant.products.aiWaiting).toBeTruthy();
      expect(m.Merchant.dashboard.aiReviewTitle).toBeTruthy();
    }
  });
});

describe("OnModelPrompt", () => {
  it("links the saved product to its AI Studio", () => {
    renderIn(<OnModelPrompt place="done" autoTryOn={false} creating productId={12} />);
    expect(screen.getByRole("heading", { name: t.title })).toBeInTheDocument();
    expect(screen.getByText(t.doneManual)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.open })).toHaveAttribute(
      "href",
      "/merchant/products/12/ai-studio",
    );
  });

  it("has no link before the product is saved", () => {
    renderIn(<OnModelPrompt place="photos" autoTryOn creating productId={null} />);
    expect(screen.getByText(t.autoNew)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("AiReviewBadge", () => {
  it("shows only when a result waits, linking to AI Studio", () => {
    const { rerender } = render(
      <AiReviewBadge productId={5} count={2} label="Təsdiq gözləyir" name="Üzük: AI" />,
    );
    expect(screen.getByRole("link", { name: "Üzük: AI" })).toHaveAttribute(
      "href",
      "/merchant/products/5/ai-studio",
    );
    rerender(<AiReviewBadge productId={5} count={0} label="Təsdiq gözləyir" name="Üzük: AI" />);
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<AiReviewBadge productId={5} count={undefined} label="x" name="y" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
