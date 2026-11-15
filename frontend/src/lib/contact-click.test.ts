import { describe, expect, it } from "vitest";
import { parseContactClick } from "./contact-click";

describe("parseContactClick", () => {
  it("accepts a product id and a known question", () => {
    expect(parseContactClick('{"productId":7,"question":"SIZE"}')).toEqual({
      productId: 7,
      question: "SIZE",
    });
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
