import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("is symmetric and handles short hex", () => {
    expect(contrastRatio("#fff", "#777")).toBeCloseTo(contrastRatio("#777777", "#ffffff"), 10);
  });
});
