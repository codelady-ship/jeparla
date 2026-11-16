import { describe, expect, it } from "vitest";
import { mapHref } from "./map-link";

describe("mapHref", () => {
  it("opens the store's own point when it is set", () => {
    expect(mapHref({ lat: "40.409264", lng: "49.867092" }, "Nizami küç. 10")).toBe(
      "https://www.google.com/maps/search/?api=1&query=40.409264%2C49.867092",
    );
  });

  it("searches the address as text without a point", () => {
    expect(mapHref(null, "Nizami küç. 10")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Nizami%20k%C3%BC%C3%A7.%2010",
    );
  });

  it("gives no link when neither is known", () => {
    expect(mapHref(null)).toBeNull();
    expect(mapHref(undefined, "  ")).toBeNull();
  });
});
