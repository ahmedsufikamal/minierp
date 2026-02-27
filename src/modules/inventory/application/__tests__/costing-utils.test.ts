import { describe, expect, it } from "vitest";
import {
  buildTransferInboundLayersFromAllocations,
  computeSpecificIdOutboundCost,
  consumeFifoLayersDetailed,
} from "@/modules/inventory/application/costing-utils";

describe("inventory costing utils", () => {
  it("FIFO outbound consumes ordered layers and computes total cost", () => {
    const result = consumeFifoLayersDetailed(
      [
        { id: "l1", qtyRemaining: 2, unitCostMinor: 100, currency: "BDT" },
        { id: "l2", qtyRemaining: 3, unitCostMinor: 120, currency: "BDT" },
        { id: "l3", qtyRemaining: 5, unitCostMinor: 150, currency: "BDT" },
      ],
      4,
    );

    expect(result.consumedQty).toBe(4);
    expect(result.remainingQty).toBe(0);
    expect(result.allocations).toEqual([
      {
        layerId: "l1",
        qty: 2,
        unitCostMinor: 100,
        currency: "BDT",
        batchId: null,
        serialId: null,
      },
      {
        layerId: "l2",
        qty: 2,
        unitCostMinor: 120,
        currency: "BDT",
        batchId: null,
        serialId: null,
      },
    ]);
    expect(result.totalCostMinor).toBe(440);
  });

  it("FIFO transfer preserves source allocations in destination layers", () => {
    const allocations = [
      {
        layerId: "src-1",
        qty: 2,
        unitCostMinor: 100,
        currency: "BDT",
        batchId: "b-1",
        serialId: null,
      },
      {
        layerId: "src-2",
        qty: 1,
        unitCostMinor: 140,
        currency: "BDT",
        batchId: "b-1",
        serialId: null,
      },
    ] as const;

    const destination = buildTransferInboundLayersFromAllocations(allocations);

    expect(destination).toEqual([
      {
        qty: 2,
        unitCostMinor: 100,
        currency: "BDT",
        sourceLayerId: "src-1",
        batchId: "b-1",
        serialId: null,
      },
      {
        qty: 1,
        unitCostMinor: 140,
        currency: "BDT",
        sourceLayerId: "src-2",
        batchId: "b-1",
        serialId: null,
      },
    ]);
  });

  it("serial outbound uses specific-id costs and rejects missing-cost serials", () => {
    const priced = computeSpecificIdOutboundCost(
      {
        "SER-1": { receiptUnitCostMinor: 500, receiptCurrency: "BDT" },
        "SER-2": { receiptUnitCostMinor: 650, receiptCurrency: "BDT" },
      },
      ["SER-1", "SER-2"],
    );
    expect(priced.totalCostMinor).toBe(1150);
    expect(priced.currency).toBe("BDT");

    expect(() =>
      computeSpecificIdOutboundCost(
        {
          "SER-1": { receiptUnitCostMinor: 500, receiptCurrency: "BDT" },
          "SER-2": { receiptUnitCostMinor: null, receiptCurrency: "BDT" },
        },
        ["SER-1", "SER-2"],
      ),
    ).toThrow(/has no receipt cost/i);
  });

  it("batch outbound consumes only layers from requested batch", () => {
    const result = consumeFifoLayersDetailed(
      [
        { id: "l1", qtyRemaining: 4, unitCostMinor: 100, currency: "BDT", batchId: "B-A" },
        { id: "l2", qtyRemaining: 2, unitCostMinor: 110, currency: "BDT", batchId: "B-B" },
        { id: "l3", qtyRemaining: 3, unitCostMinor: 120, currency: "BDT", batchId: "B-A" },
      ],
      5,
      { batchId: "B-A" },
    );

    expect(result.consumedQty).toBe(5);
    expect(result.remainingQty).toBe(0);
    expect(result.allocations.map((row) => row.layerId)).toEqual(["l1", "l3"]);
    expect(result.totalCostMinor).toBe(520);
  });
});
