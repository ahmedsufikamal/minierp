import { describe, expect, it } from "vitest";
import { computeAverageCost, enforceNextOnHand } from "@/modules/inventory/domain/posting";

// E2E-style critical path assertion for posting math and stock safety logic.
describe("posting flow e2e critical path", () => {
  it("applies receipt then issue without violating stock rules", () => {
    const receiptOnHand = enforceNextOnHand({
      previousOnHand: 0,
      delta: 10,
      allowNegativeStock: false,
      allowNegativeOverride: false,
      itemId: "item",
      warehouseId: "wh",
    });

    const avgAfterReceipt = computeAverageCost({
      previousOnHand: 0,
      previousAvgCostMinor: 0,
      delta: 10,
      unitCostMinor: 500,
    });

    const issueOnHand = enforceNextOnHand({
      previousOnHand: receiptOnHand,
      delta: -4,
      allowNegativeStock: false,
      allowNegativeOverride: false,
      itemId: "item",
      warehouseId: "wh",
    });

    const avgAfterIssue = computeAverageCost({
      previousOnHand: receiptOnHand,
      previousAvgCostMinor: avgAfterReceipt,
      delta: -4,
      unitCostMinor: 500,
    });

    expect(receiptOnHand).toBe(10);
    expect(issueOnHand).toBe(6);
    expect(avgAfterReceipt).toBe(500);
    expect(avgAfterIssue).toBe(500);
  });
});
