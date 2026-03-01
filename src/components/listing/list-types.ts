export type StockEntryTypeFilter = "TRANSFER" | "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "COUNT";

export type StockEntryAdvancedFilterField =
  | "id"
  | "stockEntryType"
  | "sourceWarehouseId"
  | "targetWarehouseId"
  | "status"
  | "createdOn";

export type StockEntryAdvancedFilterOp = "equals" | "contains";

export type StockEntrySortField =
  | "last_updated_on"
  | "created_on"
  | "stock_entry_type"
  | "id"
  | "default_source_warehouse"
  | "default_target_warehouse";

export type SortDirection = "asc" | "desc";

export type QuickFilters = {
  id?: string;
  stockEntryType?: StockEntryTypeFilter;
  sourceWarehouseId?: string;
  targetWarehouseId?: string;
};

export type AdvancedFilter = {
  field: StockEntryAdvancedFilterField;
  op: StockEntryAdvancedFilterOp;
  value: string;
};

export type SortState = {
  field: StockEntrySortField;
  direction: SortDirection;
};

export type StockEntryListState = {
  page: number;
  limit: number;
  quickFilters: QuickFilters;
  advancedFilters: AdvancedFilter[];
  sort: SortState;
};

export type SavedFilterPreset = {
  id: string;
  name: string;
  state: Pick<StockEntryListState, "quickFilters" | "advancedFilters" | "sort">;
  createdAt: string;
};

export type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

export const stockEntryTypeOptions: Array<{ value: StockEntryTypeFilter; label: string }> = [
  { value: "TRANSFER", label: "Material Transfer" },
  { value: "RECEIPT", label: "Material Receipt" },
  { value: "ISSUE", label: "Material Issue" },
  { value: "ADJUSTMENT", label: "Stock Reconciliation" },
  { value: "COUNT", label: "Cycle Count" },
];

export const stockEntryAdvancedFilterFieldOptions: Array<{
  value: StockEntryAdvancedFilterField;
  label: string;
}> = [
  { value: "id", label: "ID" },
  { value: "stockEntryType", label: "Stock Entry Type" },
  { value: "sourceWarehouseId", label: "Default Source Warehouse" },
  { value: "targetWarehouseId", label: "Default Target Warehouse" },
  { value: "status", label: "Status" },
  { value: "createdOn", label: "Created On" },
];

export const stockEntryAdvancedFilterOperatorOptions: Array<{
  value: StockEntryAdvancedFilterOp;
  label: string;
}> = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
];

export const stockEntrySortOptions: Array<{
  label: string;
  field?: StockEntrySortField;
  direction?: SortDirection;
  disabled?: boolean;
}> = [
  { label: "Last Updated On", field: "last_updated_on", direction: "desc" },
  { label: "Created On", field: "created_on", direction: "desc" },
  { label: "Stock Entry Type", field: "stock_entry_type", direction: "asc" },
  { label: "ID", field: "id", direction: "asc" },
  { label: "Most Used", disabled: true },
  { label: "Company", disabled: true },
  { label: "Series", disabled: true },
  { label: "Purpose", disabled: true },
  { label: "Default Source Warehouse", field: "default_source_warehouse", direction: "asc" },
  { label: "Default Target Warehouse", field: "default_target_warehouse", direction: "asc" },
  { label: "Supplier Name", disabled: true },
  { label: "Per Transferred", disabled: true },
  { label: "Is Return", disabled: true },
];

export const defaultStockEntrySort: SortState = {
  field: "created_on",
  direction: "desc",
};

export function labelForStockEntryType(value: string | null | undefined): string {
  return stockEntryTypeOptions.find((option) => option.value === value)?.label ?? value ?? "Stock Entry";
}

export function labelForSortField(sort: SortState): string {
  return stockEntrySortOptions.find(
    (option) => option.field === sort.field && option.direction === sort.direction,
  )?.label ?? "Created On";
}
