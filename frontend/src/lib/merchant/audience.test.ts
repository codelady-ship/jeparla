import { describe, expect, it } from "vitest";
import { suggestAudience } from "./audience";

const tree = [
  { id: 1, slug: "uzukler", parentId: null },
  { id: 2, slug: "nisan-uzukleri", parentId: 1 },
  { id: 10, slug: "kisi-zergerliyi", parentId: null },
  { id: 11, slug: "kisi-uzukleri", parentId: 10 },
  { id: 20, slug: "usaq-zergerliyi", parentId: null },
  { id: 21, slug: "usaq-sirgalari", parentId: 20 },
  { id: 30, slug: "loop-a", parentId: 31 },
  { id: 31, slug: "loop-b", parentId: 30 },
];

describe("suggestAudience (#121)", () => {
  it("follows the root category", () => {
    expect(suggestAudience(11, tree)).toBe("MEN");
    expect(suggestAudience(21, tree)).toBe("KIDS");
    expect(suggestAudience(20, tree)).toBe("KIDS");
    expect(suggestAudience(2, tree)).toBe("UNISEX");
  });

  it("is UNISEX for an unknown category and never hangs on a broken tree", () => {
    expect(suggestAudience(999, tree)).toBe("UNISEX");
    expect(suggestAudience(null, tree)).toBe("UNISEX");
    expect(suggestAudience(30, tree)).toBe("UNISEX");
  });
});
