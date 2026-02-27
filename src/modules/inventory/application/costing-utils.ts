export type FifoLayerInput = {
  id: string;
  qtyRemaining: number;
  unitCostMinor: number;
  currency: string;
  batchId?: string | null;
  serialId?: string | null;
};

export type FifoAllocation = {
  layerId: string;
  qty: number;
  unitCostMinor: number;
  currency: string;
  batchId: string | null;
  serialId: string | null;
};

export function consumeFifoLayersDetailed(
  layers: readonly FifoLayerInput[],
  quantity: number,
  options?: { batchId?: string | null },
): {
  allocations: FifoAllocation[];
  totalCostMinor: number;
  consumedQty: number;
  remainingQty: number;
} {
  let remainingQty = Math.max(0, quantity);
  let totalCostMinor = 0;
  let consumedQty = 0;
  const allocations: FifoAllocation[] = [];

  for (const layer of layers) {
    if (remainingQty <= 0) break;
    if (layer.qtyRemaining <= 0) continue;
    if (options?.batchId !== undefined && (layer.batchId ?? null) !== options.batchId) continue;

    const qty = Math.min(layer.qtyRemaining, remainingQty);
    allocations.push({
      layerId: layer.id,
      qty,
      unitCostMinor: layer.unitCostMinor,
      currency: layer.currency,
      batchId: layer.batchId ?? null,
      serialId: layer.serialId ?? null,
    });
    totalCostMinor += qty * layer.unitCostMinor;
    consumedQty += qty;
    remainingQty -= qty;
  }

  return {
    allocations,
    totalCostMinor,
    consumedQty,
    remainingQty,
  };
}

export function buildTransferInboundLayersFromAllocations(
  allocations: readonly FifoAllocation[],
): Array<{
  qty: number;
  unitCostMinor: number;
  currency: string;
  sourceLayerId: string;
  batchId: string | null;
  serialId: string | null;
}> {
  return allocations.map((allocation) => ({
    qty: allocation.qty,
    unitCostMinor: allocation.unitCostMinor,
    currency: allocation.currency,
    sourceLayerId: allocation.layerId,
    batchId: allocation.batchId,
    serialId: allocation.serialId,
  }));
}

export function computeSpecificIdOutboundCost(
  serialReceipts: Record<string, { receiptUnitCostMinor: number | null; receiptCurrency: string | null }>,
  serialNumbers: readonly string[],
): {
  totalCostMinor: number;
  currency: string | null;
} {
  let totalCostMinor = 0;
  let currency: string | null = null;

  for (const serialNumber of serialNumbers) {
    const serial = serialReceipts[serialNumber];
    if (!serial || serial.receiptUnitCostMinor == null) {
      throw new Error(`Serial ${serialNumber} has no receipt cost`);
    }
    totalCostMinor += serial.receiptUnitCostMinor;
    currency = currency ?? serial.receiptCurrency ?? null;
  }

  return {
    totalCostMinor,
    currency,
  };
}
