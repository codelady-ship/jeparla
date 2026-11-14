import { describe, expect, it } from "vitest";
import {
  formatSize,
  formatTenths,
  fromCircumference,
  fromDiameter,
  inTable,
  parseMm,
  ringTable,
} from "./ring-size";

describe("parseMm", () => {
  it.each([
    ["17", BigInt(1700)],
    ["17.5", BigInt(1750)],
    ["17,5", BigInt(1750)],
    ["53,25", BigInt(5325)],
    [" 16 ", BigInt(1600)],
    ["016.05", BigInt(1605)],
  ])("reads %s as %s hundredths", (input, expected) => {
    expect(parseMm(input)).toBe(expected);
  });

  it.each(["", "abc", "17.555", "-17", "1e2", "17.", "0", "0,0", "1234", "17 mm"])(
    "rejects %j",
    (input) => {
      expect(parseMm(input)).toBeNull();
    },
  );
});

describe("fromDiameter", () => {
  it("size 17: 17.0 mm across, 53.4 mm around, ISO 53", () => {
    expect(fromDiameter(BigInt(1700))).toEqual({
      diameterTenths: BigInt(170),
      circumferenceTenths: BigInt(534), // π × 17 = 53.407...
      sizeHalves: BigInt(34),
      isoSize: BigInt(53),
    });
  });

  it("size 16.5: 51.8 mm around (51.836...), ISO 52", () => {
    const m = fromDiameter(BigInt(1650));
    expect(m.circumferenceTenths).toBe(BigInt(518));
    expect(m.isoSize).toBe(BigInt(52));
  });

  it("rounds exactly where a float would drift: 50.265... -> 50.3", () => {
    expect(fromDiameter(BigInt(1600)).circumferenceTenths).toBe(BigInt(503));
  });

  it("a diameter half-way between two sizes goes to the larger one", () => {
    expect(fromDiameter(BigInt(1675)).sizeHalves).toBe(BigInt(34)); // 16.75 -> 17
    expect(fromDiameter(BigInt(1674)).sizeHalves).toBe(BigInt(33)); // 16.74 -> 16.5
  });
});

describe("fromCircumference", () => {
  it("53.4 mm around is size 17 (17.0 mm across), ISO 53", () => {
    expect(fromCircumference(BigInt(5340))).toEqual({
      diameterTenths: BigInt(170), // 53.4 / π = 16.997...
      circumferenceTenths: BigInt(534),
      sizeHalves: BigInt(34),
      isoSize: BigInt(53),
    });
  });

  it("52 mm around is size 16.5 (16.552... mm across)", () => {
    const m = fromCircumference(BigInt(5200));
    expect(m.diameterTenths).toBe(BigInt(166));
    expect(m.sizeHalves).toBe(BigInt(33));
    expect(m.isoSize).toBe(BigInt(52));
  });

  it("does not round twice: the size comes from the exact diameter", () => {
    // 52.62 mm / π = 16.7495... mm: 16.5, although the diameter shows as 16.7.
    const m = fromCircumference(BigInt(5262));
    expect(m.diameterTenths).toBe(BigInt(167));
    expect(m.sizeHalves).toBe(BigInt(33));
  });

  it("agrees with the table for every size", () => {
    for (const row of ringTable()) {
      expect(fromCircumference(row.circumferenceTenths * BigInt(10)).sizeHalves).toBe(
        row.sizeHalves,
      );
    }
  });
});

describe("ringTable", () => {
  it("lists sizes 15 to 24 in half steps", () => {
    const rows = ringTable();
    expect(rows).toHaveLength(19);
    expect(rows[0]).toEqual({
      diameterTenths: BigInt(150),
      circumferenceTenths: BigInt(471),
      sizeHalves: BigInt(30),
      isoSize: BigInt(47),
    });
    expect(rows.at(-1)).toEqual({
      diameterTenths: BigInt(240),
      circumferenceTenths: BigInt(754),
      sizeHalves: BigInt(48),
      isoSize: BigInt(75),
    });
  });

  it("knows which sizes it covers", () => {
    expect(inTable(BigInt(30))).toBe(true);
    expect(inTable(BigInt(48))).toBe(true);
    expect(inTable(BigInt(29))).toBe(false);
    expect(inTable(BigInt(49))).toBe(false);
  });
});

describe("formatting", () => {
  it("shows mm with one decimal and the locale's separator", () => {
    expect(formatTenths(BigInt(534), "az")).toBe("53,4");
    expect(formatTenths(BigInt(534), "ru")).toBe("53,4");
    expect(formatTenths(BigInt(534), "en")).toBe("53.4");
    expect(formatTenths(BigInt(170), "en")).toBe("17.0");
  });

  it("shows whole and half sizes", () => {
    expect(formatSize(BigInt(34), "az")).toBe("17");
    expect(formatSize(BigInt(35), "az")).toBe("17,5");
    expect(formatSize(BigInt(35), "en")).toBe("17.5");
  });
});
