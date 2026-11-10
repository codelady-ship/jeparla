import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/i18n/alternates";
import { DEFAULT_OG_IMAGE, openGraph } from "./open-graph";

describe("openGraph", () => {
  it("gives a shared link the page's own URL, site name and language", () => {
    expect(openGraph("en", "/stores/ayzer")).toMatchObject({
      url: `${SITE_URL}/en/stores/ayzer`,
      siteName: "Jeparla",
      locale: "en",
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    });
    expect(openGraph("az")).toMatchObject({ url: `${SITE_URL}/az` });
  });

  it("lets a page bring its own picture and title", () => {
    const og = openGraph("ru", "/products/ring", {
      title: "Кольцо",
      images: [{ url: "/demo/ring.jpg", alt: "Кольцо" }],
    });
    expect(og).toMatchObject({ title: "Кольцо", images: [{ url: "/demo/ring.jpg" }] });
  });
});
