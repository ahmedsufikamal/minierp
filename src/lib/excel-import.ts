import * as XLSX from "xlsx";

export interface TotalSummaryRow {
  slNo?: string | number;
  mlfb?: string;
  totalReceivedQty?: number;
  soldQty?: number;
  inventoryQty?: number;
  rateInBDT?: number;
  totalCostPriceInBDT?: number;
  totalSoldPrice?: number;
  inventoryInBDT?: number;
  category?: string;
  subCategory?: string;
  ratingType?: string;
  description?: string;
  coo?: string;
  invoiceNum?: string;
  inDate?: string;
  outDate?: string;
  outDates?: string[];
  chalanNumber?: string;
  chalanNumbers?: string[];
  remarks?: string;
  brand?: string;
}

export interface LocationRow {
  slNo?: string | number;
  newStock?: string;
  qty?: string | number;
  storeLocation?: string;
  qtyNumeric?: number;
}

export interface ParsedExcelData {
  totalSummary: TotalSummaryRow[];
  locations: LocationRow[];
  errors: string[];
  warnings: string[];
}

/**
 * Parse quantity string that may contain "1+1" format
 * Returns the sum of all numbers found
 */
export function parseQty(qtyStr: string | number | undefined | null): number {
  if (qtyStr == null) return 0;
  if (typeof qtyStr === "number") return Math.round(qtyStr);
  
  const str = String(qtyStr).trim();
  if (!str) return 0;
  
  // Handle "1+1" format by splitting on + and summing
  if (str.includes("+")) {
    const parts = str.split("+").map(p => p.trim());
    let sum = 0;
    for (const part of parts) {
      const num = Number(part);
      if (Number.isFinite(num)) {
        sum += num;
      }
    }
    return Math.round(sum);
  }
  
  // Try parsing as regular number
  const num = Number(str.replace(/,/g, ""));
  return Number.isFinite(num) ? Math.round(num) : 0;
}

function splitMultiline(value: string | number | undefined | null): string[] {
  if (value == null) return [];
  return String(value)
    .split(/\r?\n|,|;|\|/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseDateString(value: string): string {
  const trimmed = value.trim();
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]);
    const yearRaw = Number(dotMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? trimmed : fallback.toISOString().slice(0, 10);
}

export function parseOutDates(value: string | number | undefined | null): string[] {
  return splitMultiline(value).map(parseDateString);
}

export function parseChalanNumbers(value: string | number | undefined | null): string[] {
  return splitMultiline(value);
}

/**
 * Parse store location string that may be comma-separated
 * Returns array of trimmed location codes
 */
export function parseStoreLocations(locationStr: string | undefined | null): string[] {
  if (!locationStr) return [];
  return String(locationStr)
    .split(",")
    .map(loc => loc.trim())
    .filter(loc => loc.length > 0);
}

/**
 * Allocate quantity across locations
 * If divisible evenly, split; otherwise assign all to first location
 * Returns array of { location, qty } pairs
 */
export function allocateQtyToLocations(
  totalQty: number,
  locations: string[]
): Array<{ location: string; qty: number; warning?: string }> {
  if (locations.length === 0) return [];
  if (locations.length === 1) {
    return [{ location: locations[0], qty: totalQty }];
  }
  
  const perLocation = Math.floor(totalQty / locations.length);
  const remainder = totalQty % locations.length;
  
  if (remainder === 0) {
    // Evenly divisible
    return locations.map(loc => ({ location: loc, qty: perLocation }));
  } else {
    // Not evenly divisible - assign all to first, flag warning
    return [
      { 
        location: locations[0], 
        qty: totalQty,
        warning: `Qty ${totalQty} not evenly divisible by ${locations.length} locations. Assigned all to ${locations[0]}. Manual allocation may be needed.`
      },
      ...locations.slice(1).map(loc => ({ location: loc, qty: 0 }))
    ];
  }
}

/**
 * Find column index by header name (case-insensitive, flexible matching)
 */
function findColumnIndex(headers: string[], searchTerms: string[]): number {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  for (const term of searchTerms) {
    const normalized = term.toLowerCase().trim();
    const idx = normalizedHeaders.findIndex(h => h.includes(normalized) || normalized.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse Excel file and extract data from both sheets
 */
export function parseExcelFile(fileBuffer: Buffer): ParsedExcelData {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Find sheets
  const totalSummarySheetName = workbook.SheetNames.find(
    name => name.toLowerCase().includes("total summary")
  );
  const locationSheetName = workbook.SheetNames.find(
    name => name.toLowerCase().includes("stock item location") || 
            name.toLowerCase().includes("location")
  );
  
  if (!totalSummarySheetName) {
    errors.push('Sheet "Total Summary" not found');
  }
  if (!locationSheetName) {
    warnings.push('Sheet "Stock Item Location & Qty" not found - location data will be skipped');
  }
  
  const totalSummary: TotalSummaryRow[] = [];
  const locations: LocationRow[] = [];
  
  // Parse Total Summary sheet
  if (totalSummarySheetName) {
    const sheet = workbook.Sheets[totalSummarySheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    
    if (jsonData.length === 0) {
      errors.push('Sheet "Total Summary" is empty');
    } else {
      // Get headers from first row
      const firstRow = jsonData[0] as Record<string, unknown>;
      const headers = Object.keys(firstRow);
      
      // Map headers to our expected columns
      const colMap = {
        slNo: findColumnIndex(headers, ["sl. no", "sl no", "serial", "no"]),
        mlfb: findColumnIndex(headers, ["mlfb", "new stock", "item code", "sku"]),
        totalReceivedQty: findColumnIndex(headers, ["total received quantity", "received qty", "received"]),
        soldQty: findColumnIndex(headers, ["sold quantity", "sold qty", "sold"]),
        inventoryQty: findColumnIndex(headers, ["inventory quantity", "inventory qty", "stock", "qty"]),
        rateInBDT: findColumnIndex(headers, ["rate in bdt", "rate", "unit price"]),
        totalCostPriceInBDT: findColumnIndex(headers, ["total cost price in bdt", "total cost", "cost"]),
        totalSoldPrice: findColumnIndex(headers, ["total sold price", "sold price"]),
        inventoryInBDT: findColumnIndex(headers, ["inventory in bdt", "inventory value"]),
        category: findColumnIndex(headers, ["category"]),
        subCategory: findColumnIndex(headers, ["sub category", "subcategory"]),
        ratingType: findColumnIndex(headers, ["rating", "type", "rating (kw)/ type"]),
        description: findColumnIndex(headers, ["description", "desc"]),
        coo: findColumnIndex(headers, ["coo", "country of origin"]),
        invoiceNum: findColumnIndex(headers, ["invoice num", "invoice number", "invoice"]),
        inDate: findColumnIndex(headers, ["in date", "date in", "received date"]),
        outDate: findColumnIndex(headers, ["out date", "date out", "sold date"]),
        chalanNumber: findColumnIndex(headers, ["chalan number", "chalan", "challan"]),
        remarks: findColumnIndex(headers, ["remarks", "note", "notes"]),
        brand: findColumnIndex(headers, ["brand"]),
      };
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as Record<string, unknown>;
        const values = Object.values(row);
        
        const mlfb = colMap.mlfb >= 0 ? String(values[colMap.mlfb] || "").trim() : "";
        if (!mlfb) continue; // Skip rows without MLFB
        
        const rowData: TotalSummaryRow = {
          mlfb,
          brand: colMap.brand >= 0 ? String(values[colMap.brand] || "").trim() : undefined,
          totalReceivedQty: colMap.totalReceivedQty >= 0 ? parseQty(values[colMap.totalReceivedQty]) : undefined,
          soldQty: colMap.soldQty >= 0 ? parseQty(values[colMap.soldQty]) : undefined,
          inventoryQty: colMap.inventoryQty >= 0 ? parseQty(values[colMap.inventoryQty]) : undefined,
          rateInBDT: colMap.rateInBDT >= 0 ? Number(String(values[colMap.rateInBDT] || "0").replace(/,/g, "")) : undefined,
          totalCostPriceInBDT: colMap.totalCostPriceInBDT >= 0 ? Number(String(values[colMap.totalCostPriceInBDT] || "0").replace(/,/g, "")) : undefined,
          totalSoldPrice: colMap.totalSoldPrice >= 0 ? Number(String(values[colMap.totalSoldPrice] || "0").replace(/,/g, "")) : undefined,
          inventoryInBDT: colMap.inventoryInBDT >= 0 ? Number(String(values[colMap.inventoryInBDT] || "0").replace(/,/g, "")) : undefined,
          category: colMap.category >= 0 ? String(values[colMap.category] || "").trim() : undefined,
          subCategory: colMap.subCategory >= 0 ? String(values[colMap.subCategory] || "").trim() : undefined,
          ratingType: colMap.ratingType >= 0 ? String(values[colMap.ratingType] || "").trim() : undefined,
          description: colMap.description >= 0 ? String(values[colMap.description] || "").trim() : undefined,
          coo: colMap.coo >= 0 ? String(values[colMap.coo] || "").trim() : undefined,
          invoiceNum: colMap.invoiceNum >= 0 ? String(values[colMap.invoiceNum] || "").trim() : undefined,
          inDate: colMap.inDate >= 0 ? String(values[colMap.inDate] || "").trim() : undefined,
          outDate: colMap.outDate >= 0 ? String(values[colMap.outDate] || "").trim() : undefined,
          outDates: colMap.outDate >= 0 ? parseOutDates(values[colMap.outDate]) : undefined,
          chalanNumber: colMap.chalanNumber >= 0 ? String(values[colMap.chalanNumber] || "").trim() : undefined,
          chalanNumbers: colMap.chalanNumber >= 0 ? parseChalanNumbers(values[colMap.chalanNumber]) : undefined,
          remarks: colMap.remarks >= 0 ? String(values[colMap.remarks] || "").trim() : undefined,
        };
        
        totalSummary.push(rowData);
      }
    }
  }
  
  // Parse Location sheet
  if (locationSheetName) {
    const sheet = workbook.Sheets[locationSheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    
    if (jsonData.length > 0) {
      const firstRow = jsonData[0] as Record<string, unknown>;
      const headers = Object.keys(firstRow);
      
      const colMap = {
        slNo: findColumnIndex(headers, ["sl. no", "sl no", "serial", "no"]),
        newStock: findColumnIndex(headers, ["new stock", "mlfb", "item code", "sku"]),
        qty: findColumnIndex(headers, ["qty", "quantity"]),
        storeLocation: findColumnIndex(headers, ["store location", "location", "loc"]),
        qtyNumeric: findColumnIndex(headers, ["qty", "quantity"]), // May be duplicate
      };
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as Record<string, unknown>;
        const values = Object.values(row);
        
        const newStock = colMap.newStock >= 0 ? String(values[colMap.newStock] || "").trim() : "";
        if (!newStock) continue;
        
        const qtyStr = colMap.qty >= 0 ? values[colMap.qty] : undefined;
        const qty = parseQty(qtyStr);
        const storeLocation = colMap.storeLocation >= 0 ? String(values[colMap.storeLocation] || "").trim() : "";
        
        const rowData: LocationRow = {
          newStock,
          qty: qtyStr,
          qtyNumeric: qty,
          storeLocation,
        };
        
        locations.push(rowData);
      }
    }
  }
  
  return {
    totalSummary,
    locations,
    errors,
    warnings,
  };
}

/**
 * Compute file hash for idempotency checking
 */
export async function computeFileHash(fileBuffer: Buffer): Promise<string> {
  // Use Node.js crypto module
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}
