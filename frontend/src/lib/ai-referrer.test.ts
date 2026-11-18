import { describe, expect, it } from "vitest";
import { aiSource, aiVisitUrl, landingPage } from "./ai-referrer";

const none = new URLSearchParams();

describe("AI referrers (#62)", () => {
  it("recognises the assistants by referrer", () => {
    for (const referer of [
      "https://chatgpt.com/",
      "https://chat.openai.com/c/1",
      "https://www.perplexity.ai/search?q=qizil",
      "https://gemini.google.com/app",
      "https://copilot.microsoft.com/",
      "https://claude.ai/chat/abc",
      "https://chat.deepseek.com/",
    ])
      expect(aiSource(referer, none)).toBe(referer);
  });

  it("recognises the utm_source assistants add to their links", () => {
    expect(aiSource(null, new URLSearchParams("utm_source=chatgpt.com"))).toBe("chatgpt.com");
    expect(aiSource(null, new URLSearchParams("utm_source=Perplexity"))).toBe("perplexity");
    // A search engine referrer with an assistant's utm_source still counts by the utm.
    expect(aiSource("https://www.google.com/", new URLSearchParams("utm_source=copilot"))).toBe(
      "copilot",
    );
  });

  it("leaves every other visit alone", () => {
    expect(aiSource(null, none)).toBeNull();
    expect(aiSource("https://www.google.com/", none)).toBeNull();
    expect(aiSource("https://jeparla.az/az/products", none)).toBeNull();
    expect(aiSource("https://notchatgpt.com/", none)).toBeNull();
    expect(aiSource("https://chatgpt.com.evil.example/", none)).toBeNull();
    expect(aiSource(null, new URLSearchParams("utm_source=instagram"))).toBeNull();
    expect(aiSource("not a url", none)).toBeNull();
  });

  it("names the kind of landing page, never the URL", () => {
    expect(landingPage("/")).toBe("home");
    expect(landingPage("/products/qizil-uzuk-1")).toBe("product");
    expect(landingPage("/stores/ayzer-zerger")).toBe("store");
    expect(landingPage("/categories/uzukler")).toBe("category");
    expect(landingPage("/prices/monthly")).toBe("prices");
    expect(landingPage("/guides/585-vs-750-gold")).toBe("guide");
    expect(landingPage("/help")).toBe("other");
  });

  it("calls the backend counter with the source and page only", () => {
    expect(aiVisitUrl("https://api.example", "https://chatgpt.com/", "product")).toBe(
      "https://api.example/api/v1/visits/ai?source=https%3A%2F%2Fchatgpt.com%2F&page=product",
    );
  });
});
