import { describe, expect, it } from "vitest";
import { buildEnvelope, parseDsn } from "./report-error";

describe("Sentry envelope reporting (#56)", () => {
  it("parses a DSN into the envelope endpoint", () => {
    expect(parseDsn("https://abc123@o42.ingest.sentry.io/4507")).toEqual({
      endpoint: "https://o42.ingest.sentry.io/api/4507/envelope/",
      publicKey: "abc123",
      dsn: "https://abc123@o42.ingest.sentry.io/4507",
    });
  });

  it("is off without a valid DSN", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("http://abc@sentry.io/1")).toBeNull();
    expect(parseDsn("https://sentry.io/1")).toBeNull();
  });

  it("sends the error without the query string", () => {
    const dsn = parseDsn("https://abc123@o42.ingest.sentry.io/4507")!;
    const err = Object.assign(new TypeError("boom"), { digest: "123456" });
    const [header, item, body] = buildEnvelope(err, {
      dsn,
      url: "https://jeparla.az/az/search?q=adim#top",
      environment: "staging",
      now: new Date("2026-11-14T10:00:00Z"),
    }).split("\n");
    expect(JSON.parse(header)).toMatchObject({ sent_at: "2026-11-14T10:00:00.000Z", dsn: dsn.dsn });
    expect(JSON.parse(item)).toEqual({ type: "event" });
    const event = JSON.parse(body);
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(event.request).toEqual({ url: "https://jeparla.az/az/search" });
    expect(event.environment).toBe("staging");
    expect(event.tags).toEqual({ digest: "123456" });
    expect(event.exception.values[0]).toMatchObject({ type: "TypeError", value: "boom" });
    expect(body).not.toContain("adim");
  });
});
