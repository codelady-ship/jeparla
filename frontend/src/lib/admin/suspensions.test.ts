import { describe, expect, it } from "vitest";
import { pickSuspensionStatus, suspensionDecision } from "./suspensions";

describe("suspension decisions", () => {
  it("accepts CONFIRM and DISMISS with an optional note", () => {
    expect(suspensionDecision.parse({ decision: "CONFIRM" })).toEqual({
      decision: "CONFIRM",
      note: "",
    });
    expect(suspensionDecision.parse({ decision: "DISMISS", note: "  ok  " }).note).toBe("ok");
  });

  it("refuses other decisions and too long notes", () => {
    expect(suspensionDecision.safeParse({ decision: "BLOCK" }).success).toBe(false);
    expect(
      suspensionDecision.safeParse({ decision: "CONFIRM", note: "x".repeat(1001) }).success,
    ).toBe(false);
  });

  it("falls back to PENDING for an unknown status", () => {
    expect(pickSuspensionStatus("CONFIRMED")).toBe("CONFIRMED");
    expect(pickSuspensionStatus("whatever")).toBe("PENDING");
  });
});
