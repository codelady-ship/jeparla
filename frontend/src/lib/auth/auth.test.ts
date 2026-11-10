import { describe, expect, it } from "vitest";
import { fieldErrors, loginSchema, registerSchema } from "./schemas";
import { decodeSession, encodeSession, homeFor, safeNext } from "./session";

describe("session cookie", () => {
  it("round-trips, including Azerbaijani letters", () => {
    const s = { name: "Şəhla Əliyeva", email: "s@example.az", role: "MERCHANT" as const };
    expect(decodeSession(encodeSession(s))).toEqual(s);
  });
  it("rejects garbage and unknown roles", () => {
    expect(decodeSession("not-base64!")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
    const bad = Buffer.from(JSON.stringify({ name: "x", email: "x", role: "ROOT" })).toString(
      "base64url",
    );
    expect(decodeSession(bad)).toBeNull();
  });
  it("sends each role home", () => {
    expect(homeFor("ADMIN")).toBe("/admin");
    expect(homeFor("MERCHANT")).toBe("/merchant");
    expect(homeFor("USER")).toBe("/");
  });
  it("allows only same-site next paths", () => {
    expect(safeNext("/favorites")).toBe("/favorites");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext(`/${String.fromCharCode(92)}evil.example`)).toBeNull();
  });
});

describe("auth schemas", () => {
  it("validates login", () => {
    const r = loginSchema.safeParse({ login: "bad", password: "" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(fieldErrors(r.error)).toEqual({ login: "loginInvalid", password: "required" });
    expect(loginSchema.safeParse({ login: "050 123 45 67", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ login: "a@b.az", password: "x" }).success).toBe(true);
  });
  it("validates register password rules and confirmation", () => {
    const r = registerSchema.safeParse({
      name: "Aysel",
      email: "a@b.az",
      password: "abcdefgh",
      confirm: "abcdefgx",
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(fieldErrors(r.error)).toMatchObject({
        password: "passwordDigit",
        confirm: "passwordMismatch",
      });
    expect(
      registerSchema.safeParse({
        name: "Aysel",
        email: " A@b.az ",
        password: "parol123",
        confirm: "parol123",
      }).success,
    ).toBe(true);
  });
});
