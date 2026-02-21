import { describe, expect, it } from "vitest";
import { computeAverageCost, enforceNextOnHand } from "@/modules/inventory/domain/posting";

describe("posting invariants", () => {
  it("prevents negative stock when enabled", () => {
    expect(() =>
      enforceNextOnHand({
        previousOnHand: 2,
        delta: -3,
        allowNegativeStock: false,
        allowNegativeOverride: false,
        itemId: "item-1",
        warehouseId: "wh-1",
      }),
    ).toThrowError(/Negative stock prevented/);
  });

  it("allows negative stock when override is enabled", () => {
    const next = enforceNextOnHand({
      previousOnHand: 2,
      delta: -3,
      allowNegativeStock: false,
      allowNegativeOverride: true,
      itemId: "item-1",
      warehouseId: "wh-1",
    });

    expect(next).toBe(-1);
  });

  it("computes weighted average cost on positive delta", () => {
    const avg = computeAverageCost({
      previousOnHand: 10,
      previousAvgCostMinor: 500,
      delta: 5,
      unitCostMinor: 700,
    });

    expect(avg).toBe(567);
  });

  it("keeps average cost on outbound movement", () => {
    const avg = computeAverageCost({
      previousOnHand: 10,
      previousAvgCostMinor: 500,
      delta: -2,
      unitCostMinor: 700,
    });

    expect(avg).toBe(500);
  });
});
