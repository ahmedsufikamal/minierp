import { describe, expect, it } from "vitest";
import { calculateReorderSuggestion } from "@/modules/inventory/domain/reorder";

describe("reorder suggestion", () => {
  it("does not suggest reorder when available > reorder point", () => {
    const result = calculateReorderSuggestion({
      onHand: 50,
      reserved: 5,
      incoming: 10,
      outgoing: 5,
      reorderPoint: 20,
      reorderQty: 15,
      maxQty: 80,
    });

    expect(result.shouldReorder).toBe(false);
    expect(result.suggestedQty).toBe(0);
  });

  it("suggests reorder quantity when available <= reorder point", () => {
    const result = calculateReorderSuggestion({
      onHand: 10,
      reserved: 2,
      incoming: 0,
      outgoing: 0,
      reorderPoint: 12,
      reorderQty: 20,
      maxQty: 50,
    });

    expect(result.shouldReorder).toBe(true);
    expect(result.availableQty).toBe(8);
    expect(result.suggestedQty).toBeGreaterThanOrEqual(20);
  });
});
