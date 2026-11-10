import { describe, expect, it } from "vitest";
import { serviceWorkerSource } from "./service-worker";
import { swStrategy } from "./sw-policy";

const ORIGIN = "https://jeparla.az";
const at = (path: string, origin = ORIGIN) => {
  const url = new URL(path, origin);
  return { origin: url.origin, pathname: url.pathname, search: url.search };
};
const get = { method: "GET", mode: "no-cors", rsc: false };
const nav = { method: "GET", mode: "navigate", rsc: false };

describe("service worker request policy", () => {
  it.each([
    "/_next/static/chunks/app-1a2b3c.js",
    "/_next/static/media/cormorant-latin.woff2",
    "/_next/static/css/app.css",
    "/icons/icon-192.png",
    "/demo/ring-gold-1.jpg",
    "/placeholders/product.svg",
    "/icon.svg",
  ])("caches static file %s first", (path) => {
    expect(swStrategy(at(path), get, ORIGIN)).toBe("static");
  });

  it("loads pages from the network (prices are never served from a cache)", () => {
    expect(swStrategy(at("/az/products/qizil-uzuk"), nav, ORIGIN)).toBe("page");
    expect(swStrategy(at("/en"), nav, ORIGIN)).toBe("page");
  });

  it.each([
    ["API calls", at("/api/suggest?q=ring"), get],
    ["RSC payloads (header)", at("/az/products"), { ...get, rsc: true }],
    ["RSC payloads (query)", at("/az/products?_rsc=abc"), get],
    ["other origins", at("/ring.jpg", "https://cdn.example.com"), get],
    ["POST requests", at("/api/saved"), { ...get, method: "POST" }],
    ["hero video", at("/hero/enter-mobile.mp4"), get],
    ["metadata routes", at("/az/manifest.webmanifest"), get],
  ])("leaves %s alone", (_, url, request) => {
    expect(swStrategy(url, request, ORIGIN)).toBe("pass");
  });

  it("builds a script that parses, with the version and locales inside", () => {
    const source = serviceWorkerSource({ version: "abc123", locales: ["az", "en", "ru"] });
    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain('"abc123"');
    expect(source).toContain('["az","en","ru"]');
  });
});
