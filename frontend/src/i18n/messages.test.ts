import { describe, expect, it } from "vitest";
import az from "../../messages/az.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function values(obj: object): string[] {
  return Object.values(obj).flatMap((v) => (v && typeof v === "object" ? values(v) : [v]));
}

const base = keys(az).sort();

describe("messages", () => {
  it.each([
    ["en", en],
    ["ru", ru],
  ])("%s has exactly the same keys as az", (_, messages) => {
    expect(keys(messages).sort()).toEqual(base);
  });

  it.each([
    ["az", az],
    ["en", en],
    ["ru", ru],
  ])("%s has no empty strings and no emoji", (_, messages) => {
    for (const v of values(messages)) {
      expect(String(v).trim()).not.toBe("");
      expect(String(v)).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
