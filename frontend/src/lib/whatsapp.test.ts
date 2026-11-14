import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import az from "../../messages/az.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import { CONTACT_QUESTIONS, whatsappLink } from "./whatsapp";

describe("whatsappLink", () => {
  it("keeps only digits of the number and encodes the message", () => {
    const url = whatsappLink("+994 50 000 00 01", "Salam! Üzük JP-0001 https://x.az/p?a=1&b=2");
    expect(url.startsWith("https://wa.me/994500000001?text=")).toBe(true);
    const text = new URL(url).searchParams.get("text");
    expect(text).toBe("Salam! Üzük JP-0001 https://x.az/p?a=1&b=2");
  });
});

describe("ready questions (#111)", () => {
  const product = {
    name: "Nişan üzüyü Şəms",
    variant: "585 · 3,2 q · Ölçü 17",
    sku: "JP-0001",
    url: "https://jeparla.az/az/products/nisan-uzuyu?ref=x&b=1",
  };

  for (const [locale, messages] of [
    ["az", az],
    ["en", en],
    ["ru", ru],
  ] as const) {
    it(`builds every question in ${locale} with code and link intact`, () => {
      const t = createTranslator({ locale, messages, namespace: "Pdp" });
      for (const q of CONTACT_QUESTIONS) {
        expect(t(`contact.questions.${q}`)).not.toBe("");
        const message =
          q === "GENERAL"
            ? t("whatsappMessage", { name: product.name, sku: product.sku, url: product.url })
            : t(`contact.messages.${q}`, { product: t("contact.product", product) });
        const text = new URL(whatsappLink("+994500000001", message)).searchParams.get("text");
        expect(text).toBe(message);
        expect(text).toContain(product.sku);
        expect(text).toContain(product.url);
        expect(text).toContain("Şəms");
      }
    });
  }
});
