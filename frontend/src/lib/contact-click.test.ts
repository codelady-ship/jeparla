import { describe, expect, it } from "vitest";
import { parseContactClick } from "./contact-click";

describe("parseContactClick", () => {
  it("accepts a product id and a known question", () => {
    expect(parseContactClick('{"productId":7,"question":"SIZE"}')).toEqual({
      productId: 7,
      question: "SIZE",
    });
  });

  it("keeps a shared-link source and drops a blank or long one (#100)", () => {
    expect(parseContactClick('{"productId":7,"question":"SIZE","ref":"instagram"}')).toEqual({
      productId: 7,
      question: "SIZE",
      ref: "instagram",
    });
    expect(parseContactClick('{"productId":7,"question":"SIZE","ref":" "}')).toEqual({
      productId: 7,
      question: "SIZE",
    });
    const long = JSON.stringify({ productId: 7, question: "SIZE", ref: "x".repeat(65) });
    expect(parseContactClick(long)).toEqual({ productId: 7, question: "SIZE" });
  });

  it("drops unknown questions, bad ids and other bodies", () => {
    expect(parseContactClick('{"productId":7,"question":"HELLO"}')).toBeNull();
    expect(parseContactClick('{"productId":-1,"question":"PRICE"}')).toBeNull();
    expect(parseContactClick('{"productId":"7","question":"PRICE"}')).toBeNull();
    expect(parseContactClick('{"productId":1.5,"question":"PRICE"}')).toBeNull();
    expect(parseContactClick("not json")).toBeNull();
    expect(parseContactClick("null")).toBeNull();
  });
});
