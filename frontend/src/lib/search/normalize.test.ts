import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeQuery } from "./normalize";

describe("normalizeQuery", () => {
  it.each([
    ["Üzük", "uzuk"],
    ["SIRĞA", "sirga"],
    ["Qızıl", "qizil"],
    ["İnci boyunbağı", "inci boyunbagi"],
    ["Şəms   Zərgər!", "sems zerger"],
    ["Çəhrayı", "cehrayi"],
  ])("%s -> %s", (input, out) => {
    expect(normalizeQuery(input)).toBe(out);
  });

  it("keeps Cyrillic letters", () => {
    expect(normalizeQuery("Кольцо Золото")).toBe("кольцо золото");
  });
});

describe("matchesQuery", () => {
  it("finds Azerbaijani words typed without special letters", () => {
    expect(matchesQuery("Qızıl nişan üzüyü", "uzu")).toBe(true);
    expect(matchesQuery("Gümüş sırğa", "sirga gumus")).toBe(true);
  });

  it("requires every word", () => {
    expect(matchesQuery("Gümüş sırğa", "sirga qizil")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matchesQuery("anything", "  ")).toBe(true);
  });
});
