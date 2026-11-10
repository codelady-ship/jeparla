import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError, httpApi, isNotFound } from "./http";

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("sends the token, the language and a JSON body", async () => {
    const fetch = stubFetch(json({ ok: true }));
    await apiFetch("/merchant/store", {
      method: "PUT",
      body: { name: "Ayzər" },
      token: "abc",
      locale: "ru",
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/merchant\/store$/);
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"name":"Ayzər"}');
    expect(init.headers).toMatchObject({
      Authorization: "Bearer abc",
      "Accept-Language": "ru",
      "Content-Type": "application/json",
    });
  });

  it("turns a ProblemDetail into an ApiError with code and field errors", async () => {
    stubFetch(
      json(
        { code: "merchant.sku_taken", detail: "SKU", errors: [{ field: "sku", message: "x" }] },
        409,
      ),
    );
    const error = await apiFetch("/merchant/products", { method: "POST", body: {} }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "merchant.sku_taken",
      fieldErrors: [{ field: "sku", message: "x" }],
    });
  });

  it("reports an unreachable backend as status 0", async () => {
    stubFetch(new TypeError("fetch failed"));
    const error = await apiFetch("/stores").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0 });
    expect(isNotFound(error)).toBe(false);
  });

  it("answers 204 with null", async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(apiFetch("/notifications/read-all", { method: "POST" })).resolves.toBeNull();
  });
});

describe("httpApi", () => {
  it("does not call the API for an empty id list (#41 review)", async () => {
    const fetch = stubFetch(json([]));
    await expect(httpApi.getProductsByIds([])).resolves.toEqual([]);
    await expect(httpApi.getCompareItems([])).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps 404 to null for a product or store", async () => {
    stubFetch(json({ code: "not_found" }, 404));
    await expect(httpApi.getProduct("missing")).resolves.toBeNull();
    stubFetch(json({ code: "server" }, 500));
    await expect(httpApi.getStore("x")).rejects.toBeInstanceOf(ApiError);
  });
});
