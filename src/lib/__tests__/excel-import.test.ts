import { describe, it, expect } from "vitest";
import { parseQty, parseStoreLocations, allocateQtyToLocations, parseOutDates, parseChalanNumbers } from "../excel-import";
import { normalizeSku } from "../../domain/inventory/sku";

describe("parseQty", () => {
  it("should parse numeric strings", () => {
    expect(parseQty("10")).toBe(10);
    expect(parseQty("0")).toBe(0);
    expect(parseQty("100")).toBe(100);
  });

  it("should parse numbers", () => {
    expect(parseQty(10)).toBe(10);
    expect(parseQty(0)).toBe(0);
    expect(parseQty(100.5)).toBe(101); // rounds
  });

  it("should parse '1+1' format", () => {
    expect(parseQty("1+1")).toBe(2);
    expect(parseQty("2+3+5")).toBe(10);
    expect(parseQty("10+20+30")).toBe(60);
  });

  it("should handle spaces in '1+1' format", () => {
    expect(parseQty("1 + 1")).toBe(2);
    expect(parseQty(" 2 + 3 ")).toBe(5);
  });

  it("should handle comma-separated numbers", () => {
    expect(parseQty("1,000")).toBe(1000);
    expect(parseQty("10,000")).toBe(10000);
  });

  it("should return 0 for null/undefined/empty", () => {
    expect(parseQty(null)).toBe(0);
    expect(parseQty(undefined)).toBe(0);
    expect(parseQty("")).toBe(0);
    expect(parseQty("   ")).toBe(0);
  });

  it("should round decimal values", () => {
    expect(parseQty("10.7")).toBe(11);
    expect(parseQty("10.2")).toBe(10);
  });
});

describe("parseStoreLocations", () => {
  it("should parse comma-separated locations", () => {
    expect(parseStoreLocations("Z1,Z2")).toEqual(["Z1", "Z2"]);
    expect(parseStoreLocations("A1,A2,A3")).toEqual(["A1", "A2", "A3"]);
  });

  it("should trim whitespace", () => {
    expect(parseStoreLocations(" Z1 , Z2 ")).toEqual(["Z1", "Z2"]);
    expect(parseStoreLocations("A1, A2, A3")).toEqual(["A1", "A2", "A3"]);
  });

  it("should handle single location", () => {
    expect(parseStoreLocations("Z1")).toEqual(["Z1"]);
    expect(parseStoreLocations(" A6 ")).toEqual(["A6"]);
  });

  it("should return empty array for null/undefined/empty", () => {
    expect(parseStoreLocations(null)).toEqual([]);
    expect(parseStoreLocations(undefined)).toEqual([]);
    expect(parseStoreLocations("")).toEqual([]);
    expect(parseStoreLocations("   ")).toEqual([]);
  });

  it("should filter out empty strings", () => {
    expect(parseStoreLocations("Z1,,Z2")).toEqual(["Z1", "Z2"]);
    expect(parseStoreLocations(",Z1,")).toEqual(["Z1"]);
  });
});

describe("allocateQtyToLocations", () => {
  it("should allocate evenly when divisible", () => {
    const result = allocateQtyToLocations(10, ["Z1", "Z2"]);
    expect(result).toEqual([
      { location: "Z1", qty: 5 },
      { location: "Z2", qty: 5 },
    ]);
  });

  it("should allocate all to first location when not divisible", () => {
    const result = allocateQtyToLocations(10, ["Z1", "Z2", "Z3"]);
    expect(result).toEqual([
      {
        location: "Z1",
        qty: 10,
        warning: "Qty 10 not evenly divisible by 3 locations. Assigned all to Z1. Manual allocation may be needed.",
      },
      { location: "Z2", qty: 0 },
      { location: "Z3", qty: 0 },
    ]);
  });

  it("should handle single location", () => {
    const result = allocateQtyToLocations(10, ["Z1"]);
    expect(result).toEqual([{ location: "Z1", qty: 10 }]);
  });

  it("should handle zero quantity", () => {
    const result = allocateQtyToLocations(0, ["Z1", "Z2"]);
    expect(result).toEqual([
      { location: "Z1", qty: 0 },
      { location: "Z2", qty: 0 },
    ]);
  });

  it("should handle remainder correctly", () => {
    const result = allocateQtyToLocations(7, ["Z1", "Z2"]);
    expect(result).toEqual([
      {
        location: "Z1",
        qty: 7,
        warning: "Qty 7 not evenly divisible by 2 locations. Assigned all to Z1. Manual allocation may be needed.",
      },
      { location: "Z2", qty: 0 },
    ]);
  });

  it("should return empty array for empty locations", () => {
    const result = allocateQtyToLocations(10, []);
    expect(result).toEqual([]);
  });

  it("should handle large quantities", () => {
    const result = allocateQtyToLocations(1000, ["Z1", "Z2", "Z3", "Z4"]);
    expect(result).toEqual([
      { location: "Z1", qty: 250 },
      { location: "Z2", qty: 250 },
      { location: "Z3", qty: 250 },
      { location: "Z4", qty: 250 },
    ]);
  });
});

describe("parseOutDates", () => {
  it("should parse multi-line dates", () => {
    expect(parseOutDates("01.02.2024\n02.02.2024")).toEqual(["2024-02-01", "2024-02-02"]);
  });

  it("should handle comma-separated dates", () => {
    expect(parseOutDates("01.02.2024, 03.02.2024")).toEqual(["2024-02-01", "2024-02-03"]);
  });

  it("should return empty array for empty", () => {
    expect(parseOutDates("")).toEqual([]);
    expect(parseOutDates(null)).toEqual([]);
  });
});

describe("parseChalanNumbers", () => {
  it("should parse multi-line values", () => {
    expect(parseChalanNumbers("CH-1\nCH-2")).toEqual(["CH-1", "CH-2"]);
  });

  it("should handle comma-separated values", () => {
    expect(parseChalanNumbers("CH-1, CH-2")).toEqual(["CH-1", "CH-2"]);
  });
});

describe("normalizeSku", () => {
  it("should trim, uppercase, and normalize whitespace", () => {
    expect(normalizeSku("  abc  123 ")).toBe("ABC 123");
    expect(normalizeSku("mlfb-001")).toBe("MLFB-001");
  });
});
