import { describe, expect, it } from "vitest";
import colors from "@/lib/brand-colors.json";
import { buildManifest } from "./manifest";
import { offlinePageHtml } from "./offline-page";

const text = {
  description: "Zərgərlik mağazaları bir yerdə",
  catalog: "Kataloq",
  search: "Axtarış",
  favorites: "Seçilmişlər",
};

describe("web app manifest", () => {
  const m = buildManifest("ru", text);

  it("installs as a standalone app in the page language", () => {
    expect(m).toMatchObject({
      id: "/",
      name: "Jeparla",
      short_name: "Jeparla",
      display: "standalone",
      lang: "ru",
      start_url: "/ru",
      scope: "/",
      description: text.description,
    });
  });

  it("takes its colors from the design tokens", () => {
    expect(m.background_color).toBe(colors.light.bg);
    expect(m.theme_color).toBe(colors.light.bg);
  });

  it("has 192, 512 and maskable icons", () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
  });

  it("has shortcuts to the catalog, search and favorites", () => {
    expect(m.shortcuts?.map((s) => [s.name, s.url])).toEqual([
      ["Kataloq", "/ru/products"],
      ["Axtarış", "/ru/search"],
      ["Seçilmişlər", "/ru/favorites"],
    ]);
  });
});

describe("offline page", () => {
  it("is a complete page in the given language, with escaped text", () => {
    const html = offlinePageHtml({
      locale: "az",
      title: "İnternet yoxdur",
      text: 'Qiymət <b>"təzə"</b>',
      retry: "Yenidən yoxla",
    });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="az">');
    expect(html).toContain("<h1>İnternet yoxdur</h1>");
    expect(html).toContain("&#60;b&#62;&#34;təzə&#34;&#60;/b&#62;");
    expect(html).toContain(colors.dark.bg);
    expect(html).toContain("noindex");
  });
});
