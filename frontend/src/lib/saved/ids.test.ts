import { describe, expect, it } from "vitest";
import { parseIds } from "./ids";

describe("parseIds", () => {
  it("keeps unique positive integers in order, up to max", () => {
    expect(parseIds("3, 1,3,x,-2,0,1.5,7", 10)).toEqual([3, 1, 7]);
    expect(parseIds("1,2,3,4,5", 4)).toEqual([1, 2, 3, 4]);
  });
  it("handles missing input", () => {
    expect(parseIds(null, 4)).toEqual([]);
    expect(parseIds("", 4)).toEqual([]);
  });
});
