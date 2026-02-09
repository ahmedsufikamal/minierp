export type ImportMode = "OPENING_ONLY" | "HISTORY_APPROX";

export type ImportPreviewRow = {
  mlfb: string;
  brand: string;
  inventoryQty: number;
  rateInBDT: number;
  category?: string;
  subCategory?: string;
  description?: string;
  locations: Array<{ location: string; qty: number; warning?: string }>;
  warnings: string[];
  errors: string[];
};

export type ImportPreview = {
  rows: ImportPreviewRow[];
  summary: {
    totalItems: number;
    totalQty: number;
    totalValue: number;
    brands: string[];
    categories: string[];
    locations: string[];
  };
  errors: string[];
  warnings: string[];
  fileHash: string;
  alreadyImported: boolean;
  snapshotId?: string;
};

export type ImportPreviewResult =
  | { ok: true; data: ImportPreview }
  | { ok: false; error: string };

export type ImportExecuteResult =
  | { ok: true; snapshotId: string }
  | { ok: false; error: string };
