import { describe, expect, it } from "vitest";
import { indexNowKey, indexNowKeyResponse } from "./indexnow";

const KEY = "test-indexnow-key";

describe("IndexNow key file (#62)", () => {
  it("is off without a key or with an invalid one", async () => {
    expect(indexNowKey({})).toBeNull();
    expect(indexNowKey({ JEPARLA_INDEXNOW_KEY: "" })).toBeNull();
    expect(indexNowKey({ JEPARLA_INDEXNOW_KEY: "short" })).toBeNull();
    expect(indexNowKey({ JEPARLA_INDEXNOW_KEY: "has/slash-0123456789" })).toBeNull();
    const res = indexNowKeyResponse(KEY, {});
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(KEY);
  });

  it("serves the configured key as plain text at /<key>.txt", async () => {
    const env = { JEPARLA_INDEXNOW_KEY: ` ${KEY} ` };
    expect(indexNowKey(env)).toBe(KEY);
    const res = indexNowKeyResponse(KEY, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe(KEY);
  });

  it("answers 404 for any other name, so the key cannot be guessed from the response", async () => {
    const env = { JEPARLA_INDEXNOW_KEY: KEY };
    const res = indexNowKeyResponse("other-indexnow-key", env);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(KEY);
  });
});
