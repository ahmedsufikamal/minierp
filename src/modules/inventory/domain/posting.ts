import { InventoryError } from "@/modules/inventory/domain/errors";

export function enforceNextOnHand(params: {
  previousOnHand: number;
  delta: number;
  allowNegativeStock: boolean;
  allowNegativeOverride: boolean;
  itemId: string;
  warehouseId: string;
}): number {
  const nextOnHand = params.previousOnHand + params.delta;

  if (nextOnHand < 0 && !params.allowNegativeStock && !params.allowNegativeOverride) {
    throw new InventoryError(
      "CONFLICT",
      `Negative stock prevented for item ${params.itemId} in warehouse ${params.warehouseId}`,
    );
  }

  return nextOnHand;
}

export function computeAverageCost(params: {
  previousOnHand: number;
  previousAvgCostMinor: number;
  delta: number;
  unitCostMinor: number;
}): number {
  if (params.delta <= 0) return params.previousAvgCostMinor;

  const weightedCost = params.previousOnHand * params.previousAvgCostMinor + params.delta * params.unitCostMinor;
  const weightedQty = params.previousOnHand + params.delta;

  if (weightedQty <= 0) return params.unitCostMinor;
  return Math.round(weightedCost / weightedQty);
}
