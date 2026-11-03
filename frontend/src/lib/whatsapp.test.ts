import { describe, expect, it } from "vitest";
import { whatsappLink } from "./whatsapp";

describe("whatsappLink", () => {
  it("keeps only digits of the number and encodes the message", () => {
    const url = whatsappLink("+994 50 000 00 01", "Salam! Üzük JP-0001 https://x.az/p?a=1&b=2");
    expect(url.startsWith("https://wa.me/994500000001?text=")).toBe(true);
    const text = new URL(url).searchParams.get("text");
    expect(text).toBe("Salam! Üzük JP-0001 https://x.az/p?a=1&b=2");
  });
});
