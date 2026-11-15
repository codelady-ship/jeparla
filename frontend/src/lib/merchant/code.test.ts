import { describe, expect, it } from "vitest";
import { codeState } from "./code";

const now = new Date("2026-11-15T10:00:00Z");

describe("codeState", () => {
  it("is missing without an acceptance or after it ran out", () => {
    expect(codeState({}, now).kind).toBe("missing");
    expect(codeState({ codeAcceptedAt: null, codeValidUntil: null }, now).kind).toBe("missing");
    expect(
      codeState(
        { codeAcceptedAt: "2025-11-01T10:00:00Z", codeValidUntil: "2026-11-01T10:00:00Z" },
        now,
      ).kind,
    ).toBe("missing");
  });

  it("asks again within the last 30 days", () => {
    expect(
      codeState(
        { codeAcceptedAt: "2025-12-01T10:00:00Z", codeValidUntil: "2026-12-01T10:00:00Z" },
        now,
      ).kind,
    ).toBe("due");
  });

  it("is valid otherwise", () => {
    expect(
      codeState(
        { codeAcceptedAt: "2026-11-10T10:00:00Z", codeValidUntil: "2027-11-10T10:00:00Z" },
        now,
      ),
    ).toEqual({
      kind: "valid",
      acceptedAt: "2026-11-10T10:00:00Z",
      validUntil: "2027-11-10T10:00:00Z",
    });
  });
});
