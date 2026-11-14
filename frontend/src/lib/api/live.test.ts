import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const visitor = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => visitor.get(name) ?? null }),
}));
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

import { liveApi } from "./live";

const TOKEN = "frontend-token-for-tests-0123456789abcdef";
const photo = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });

function stubFetch() {
  const fn = vi.fn(async () => Response.json([]));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const sentHeaders = (fetch: ReturnType<typeof stubFetch>) =>
  (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;

beforeEach(() => visitor.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("liveApi.searchByImage (#222)", () => {
  it("names the visitor to the backend rate limit", async () => {
    vi.stubEnv("JEPARLA_FRONTEND_TOKEN", TOKEN);
    visitor.set("x-forwarded-for", "198.51.100.20, 10.0.0.1");
    const fetch = stubFetch();
    await expect(liveApi.searchByImage(photo())).resolves.toEqual({ ok: true, products: [] });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/search\/image$/);
    expect(init.method).toBe("POST");
    expect(sentHeaders(fetch)).toMatchObject({
      Accept: "application/json",
      "X-Jeparla-Frontend-Token": TOKEN,
      "X-Jeparla-Client-Ip": "198.51.100.20",
    });
  });

  it("prefers the address the CDN wrote", async () => {
    vi.stubEnv("JEPARLA_FRONTEND_TOKEN", TOKEN);
    visitor.set("cf-connecting-ip", "203.0.113.7");
    visitor.set("x-forwarded-for", "198.51.100.20");
    const fetch = stubFetch();
    await liveApi.searchByImage(photo());
    expect(sentHeaders(fetch)["X-Jeparla-Client-Ip"]).toBe("203.0.113.7");
  });

  it("sends no relay header without the shared token", async () => {
    vi.stubEnv("JEPARLA_FRONTEND_TOKEN", "");
    visitor.set("x-forwarded-for", "198.51.100.20");
    const fetch = stubFetch();
    await liveApi.searchByImage(photo());
    expect(sentHeaders(fetch)).toEqual({ Accept: "application/json" });
  });
});
