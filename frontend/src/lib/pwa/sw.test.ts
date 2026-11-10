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
  ])("caches hashed build file %s first", (path) => {
    expect(swStrategy(at(path), get, ORIGIN)).toBe("immutable");
  });

  it.each([
    "/icons/icon-192.png",
    "/demo/ring-gold-1.jpg",
    "/placeholders/product.svg",
    "/icon.svg",
    "/apple-icon.png",
  ])("revalidates unhashed file %s (it can change under the same URL)", (path) => {
    expect(swStrategy(at(path), get, ORIGIN)).toBe("revalidate");
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

/* A small in-memory stand-in for the worker globals, enough to run /sw.js. */

class FakeCache {
  entries = new Map<string, Response>();
  async match(req: Request | string) {
    const hit = this.entries.get(new URL(typeof req === "string" ? req : req.url, ORIGIN).href);
    return hit ? hit.clone() : undefined;
  }
  async put(req: Request | string, res: Response) {
    const url = new URL(typeof req === "string" ? req : req.url, ORIGIN).href;
    this.entries.set(url, new Response(await res.arrayBuffer(), res));
  }
  async addAll(urls: string[]) {
    for (const u of urls) this.entries.set(new URL(u, ORIGIN).href, new Response("offline"));
  }
  async keys() {
    return [...this.entries.keys()].map((u) => new Request(u));
  }
  async delete(req: Request) {
    return this.entries.delete(req.url);
  }
}

function runWorker(version: string, store: Map<string, FakeCache>, server: Map<string, string>) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new FakeCache());
      return store.get(name)!;
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
  };
  const fetch = async (req: Request) => {
    const body = server.get(new URL(req.url).pathname);
    if (body === undefined) return new Response("", { status: 404 });
    const res = new Response(body, { status: 200 });
    Object.defineProperty(res, "type", { value: "basic" });
    return res;
  };
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => (listeners[type] = fn),
    location: { origin: ORIGIN },
    registration: {},
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
  };
  new Function("self", "caches", "fetch", serviceWorkerSource({ version, locales: ["az"] }))(
    self,
    caches,
    fetch,
  );

  async function lifecycle(type: "install" | "activate") {
    const pending: Promise<unknown>[] = [];
    listeners[type]({ waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
  }

  /** Loads a URL through the worker; resolves with the body once background work is done. */
  async function load(path: string) {
    let response: Promise<Response> | undefined;
    const pending: Promise<unknown>[] = [];
    listeners.fetch({
      request: new Request(new URL(path, ORIGIN), { mode: "no-cors" }),
      respondWith: (p: Promise<Response>) => (response = p),
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    });
    expect(response).toBeDefined();
    const body = await (await response!).text();
    await Promise.all(pending);
    return body;
  }

  return { lifecycle, load };
}

describe("service worker caching", () => {
  it("shows a replaced image on the next load (stale-while-revalidate)", async () => {
    const server = new Map([["/demo/ring-gold-1.jpg", "old photo"]]);
    const sw = runWorker("b1", new Map(), server);
    await sw.lifecycle("install");
    await sw.lifecycle("activate");

    expect(await sw.load("/demo/ring-gold-1.jpg")).toBe("old photo");
    server.set("/demo/ring-gold-1.jpg", "new photo");
    // The cached copy answers first, the network refreshes the cache behind it.
    expect(await sw.load("/demo/ring-gold-1.jpg")).toBe("old photo");
    expect(await sw.load("/demo/ring-gold-1.jpg")).toBe("new photo");
  });

  it("keeps hashed chunks cache first, across builds", async () => {
    const chunk = "/_next/static/chunks/app-1a2b3c.js";
    const server = new Map([[chunk, "chunk v1"]]);
    const store = new Map<string, FakeCache>();
    const first = runWorker("b1", store, server);
    await first.lifecycle("activate");
    expect(await first.load(chunk)).toBe("chunk v1");

    // A new deploy removes the old chunk from the server; an old tab still gets it.
    server.delete(chunk);
    const next = runWorker("b2", store, server);
    await next.lifecycle("install");
    await next.lifecycle("activate");
    expect(await next.load(chunk)).toBe("chunk v1");
  });

  it("drops caches of older builds and unhashed files from the old static cache", async () => {
    const store = new Map<string, FakeCache>();
    const legacy = new FakeCache();
    legacy.entries.set(`${ORIGIN}/icons/icon-192.png`, new Response("old logo"));
    legacy.entries.set(`${ORIGIN}/_next/static/chunks/a.js`, new Response("chunk"));
    store.set("jeparla-static-v1", legacy);
    store.set("jeparla-assets-b1", new FakeCache());
    store.set("jeparla-offline-b1", new FakeCache());

    const server = new Map([["/icons/icon-192.png", "new logo"]]);
    const sw = runWorker("b2", store, server);
    await sw.lifecycle("install");
    await sw.lifecycle("activate");

    expect([...store.keys()].sort()).toEqual(["jeparla-offline-b2", "jeparla-static-v1"]);
    expect([...legacy.entries.keys()]).toEqual([`${ORIGIN}/_next/static/chunks/a.js`]);
    expect(await sw.load("/icons/icon-192.png")).toBe("new logo");
  });
});
