import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadSignupPhotos } from "./photos";

const jpeg = (id: string) => ({ id, name: `${id}.jpg`, url: "data:image/jpeg;base64,/9j/AA==" });

function backend() {
  const calls: { path: string; body: unknown }[] = [];
  let next = 1;
  const call = vi.fn(async (path: string, options?: { body?: unknown }) => {
    calls.push({ path, body: options?.body });
    if (path.endsWith("/uploads"))
      return { key: `k${next}`, url: `https://storage.test/${next++}`, method: "PUT", headers: {} };
    if (path.endsWith("/images")) return { id: 100 + calls.length };
    return {};
  }) as unknown as Parameters<typeof uploadSignupPhotos>[0];
  return { call, calls };
}

afterEach(() => vi.unstubAllGlobals());

describe("uploadSignupPhotos (#317)", () => {
  it("attaches the photos to the first product in the seller's order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const { call, calls } = backend();
    const saved = await uploadSignupPhotos(call, [jpeg("a"), jpeg("b")], 7, "Qizil uzuk");
    expect(saved).toBe(2);
    expect(calls.map((c) => c.path)).toEqual([
      "/merchant/products/7/images/uploads",
      "/merchant/products/7/images",
      "/merchant/products/7/images/uploads",
      "/merchant/products/7/images",
      "/merchant/products/7/images/order",
    ]);
    expect(calls[1].body).toEqual({ key: "k1", altAz: "Qizil uzuk" });
  });

  it("without a product each photo becomes a cabinet photo draft", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const { call, calls } = backend();
    expect(await uploadSignupPhotos(call, [jpeg("a")], null, "")).toBe(1);
    expect(calls).toEqual([
      {
        path: "/merchant/drafts/uploads",
        body: { kind: "PHOTO", contentType: "image/jpeg", sizeBytes: 4 },
      },
      { path: "/merchant/drafts", body: { key: "k1", kind: "PHOTO" } },
    ]);
  });

  it("counts only the photos that reached storage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 403 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 })),
    );
    const { call } = backend();
    expect(await uploadSignupPhotos(call, [jpeg("a"), jpeg("b")], null, "")).toBe(1);
  });
});
