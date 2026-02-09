export type InventoryItem = {
  id: string;
  companyId: string;
  sku: string;
  normalizedSku: string;
  name: string;
  description?: string | null;
  brandId: string;
  categoryId?: string | null;
  subCategoryId?: string | null;
  uom: string;
  unitCostMinor?: number | null;
  isActive: boolean;
};

export type StockBalance = {
  companyId: string;
  itemId: string;
  locationId?: string | null;
  qtyOnHand: number;
  avgCostMinor?: number | null;
};

export type StockLedgerEntry = {
  id: string;
  companyId: string;
  itemId: string;
  locationId?: string | null;
  txnType: string;
  qtyDelta: number;
  unitCostMinor?: number | null;
  totalCostMinor?: number | null;
  refInvoice?: string | null;
  refChalan?: string | null;
  notes?: string | null;
  meta?: Record<string, unknown> | null;
  txnDate: Date;
  snapshotId?: string | null;
  createdBy?: string | null;
};

export type InventorySnapshot = {
  id: string;
  companyId: string;
  importedAt: Date;
  sourceFileName: string;
  sourceFileHash: string;
  mode: "OPENING_ONLY" | "HISTORY_APPROX";
  status: "PENDING" | "VALIDATED" | "IMPORTED" | "FAILED";
  warnings?: unknown;
  errors?: unknown;
  createdBy?: string | null;
  createdAt: Date;
};
