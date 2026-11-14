import { describe, expect, it } from "vitest";
import { supportContact } from "./support";

describe("supportContact", () => {
  it("is empty when nothing is configured", () => {
    expect(supportContact("", "")).toEqual({ email: null, url: null });
    expect(supportContact(undefined, undefined)).toEqual({ email: null, url: null });
  });

  it("keeps a valid email address and http(s) URL", () => {
    expect(supportContact(" destek@jeparla.az ", "https://jeparla.az/support")).toEqual({
      email: "destek@jeparla.az",
      url: "https://jeparla.az/support",
    });
  });

  it("drops values that would make a broken or unsafe link", () => {
    expect(supportContact("not-an-email", "javascript:alert(1)")).toEqual({
      email: null,
      url: null,
    });
    expect(supportContact("a@b", "jeparla.az/help").url).toBeNull();
  });
});
