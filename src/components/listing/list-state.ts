import {
  type AdvancedFilter,
  type SavedFilterPreset,
  type SortState,
  type StockEntryListState,
  type StockEntrySortField,
  type StockEntryTypeFilter,
  defaultStockEntrySort,
  stockEntryTypeOptions,
} from "@/components/listing/list-types";

const DEFAULT_LIMIT = 25;
const STORAGE_KEY = "minierp:list:stock-entry:saved-filters";

function isStockEntryTypeFilter(value: string | null): value is StockEntryTypeFilter {
  return stockEntryTypeOptions.some((option) => option.value === value);
}

function isSortField(value: string | null): value is StockEntrySortField {
  return [
    "last_updated_on",
    "created_on",
    "stock_entry_type",
    "id",
    "default_source_warehouse",
    "default_target_warehouse",
  ].includes(value ?? "");
}

function isSortDirection(value: string | null): value is SortState["direction"] {
  return value === "asc" || value === "desc";
}

function defaultDirectionForSortField(field: StockEntrySortField): SortState["direction"] {
  switch (field) {
    case "stock_entry_type":
    case "id":
    case "default_source_warehouse":
    case "default_target_warehouse":
      return "asc";
    case "last_updated_on":
    case "created_on":
    default:
      return "desc";
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function createEmptyAdvancedFilter(): AdvancedFilter {
  return {
    field: "id",
    op: "equals",
    value: "",
  };
}

export function createDefaultStockEntryListState(): StockEntryListState {
  return {
    page: 1,
    limit: DEFAULT_LIMIT,
    quickFilters: {},
    advancedFilters: [],
    sort: { ...defaultStockEntrySort },
  };
}

export function normalizeAdvancedFilters(filters: AdvancedFilter[]): AdvancedFilter[] {
  return filters
    .map((filter) => ({
      field: filter.field,
      op: filter.op,
      value: filter.value.trim(),
    }))
    .filter((filter) => filter.value.length > 0);
}

export function parseStockEntryListState(searchParams: URLSearchParams): StockEntryListState {
  const defaultState = createDefaultStockEntryListState();
  const page = Number(searchParams.get("page") ?? String(defaultState.page));
  const limit = Number(searchParams.get("limit") ?? String(defaultState.limit));
  const sortField = searchParams.get("sort_field");
  const sortDirection = searchParams.get("sort_direction");
  const rawFilters = searchParams.get("filters");

  let advancedFilters: AdvancedFilter[] = [];
  if (rawFilters) {
    try {
      const parsed = JSON.parse(rawFilters) as unknown;
      if (Array.isArray(parsed)) {
        advancedFilters = parsed
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const candidate = entry as Partial<AdvancedFilter>;
            const field = candidate.field;
            const op = candidate.op;
            const value = typeof candidate.value === "string" ? candidate.value : "";
            if (
              !["id", "stockEntryType", "sourceWarehouseId", "targetWarehouseId", "status", "createdOn"].includes(
                String(field ?? ""),
              ) ||
              !["equals", "contains"].includes(String(op ?? ""))
            ) {
              return null;
            }
            return {
              field: field as AdvancedFilter["field"],
              op: op as AdvancedFilter["op"],
              value,
            };
          })
          .filter((entry): entry is AdvancedFilter => Boolean(entry));
      }
    } catch {
      advancedFilters = [];
    }
  }

  return {
    page: Number.isFinite(page) && page > 0 ? page : defaultState.page,
    limit: Number.isFinite(limit) && limit > 0 ? limit : defaultState.limit,
    quickFilters: {
      id: searchParams.get("id") ?? undefined,
      stockEntryType: isStockEntryTypeFilter(searchParams.get("stock_entry_type"))
        ? (searchParams.get("stock_entry_type") as StockEntryTypeFilter)
        : undefined,
      sourceWarehouseId: searchParams.get("source_warehouse_id") ?? undefined,
      targetWarehouseId: searchParams.get("target_warehouse_id") ?? undefined,
    },
    advancedFilters: normalizeAdvancedFilters(advancedFilters),
    sort: {
      field: isSortField(sortField) ? sortField : defaultState.sort.field,
      direction:
        isSortDirection(sortDirection)
          ? sortDirection
          : isSortField(sortField)
            ? defaultDirectionForSortField(sortField)
            : defaultState.sort.direction,
    },
  };
}

export function toStockEntryListSearchParams(state: StockEntryListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.limit !== DEFAULT_LIMIT) params.set("limit", String(state.limit));
  if (state.quickFilters.id) params.set("id", state.quickFilters.id);
  if (state.quickFilters.stockEntryType) params.set("stock_entry_type", state.quickFilters.stockEntryType);
  if (state.quickFilters.sourceWarehouseId) params.set("source_warehouse_id", state.quickFilters.sourceWarehouseId);
  if (state.quickFilters.targetWarehouseId) params.set("target_warehouse_id", state.quickFilters.targetWarehouseId);
  if (state.sort.field !== defaultStockEntrySort.field || state.sort.direction !== defaultStockEntrySort.direction) {
    params.set("sort_field", state.sort.field);
    params.set("sort_direction", state.sort.direction);
  }

  const appliedFilters = normalizeAdvancedFilters(state.advancedFilters);
  if (appliedFilters.length > 0) {
    params.set("filters", JSON.stringify(appliedFilters));
  }

  return params;
}

export function toStockEntryListQuery(state: StockEntryListState): Record<string, string | number | undefined> {
  const params = toStockEntryListSearchParams(state);
  const query = Object.fromEntries(params.entries()) as Record<string, string>;
  return {
    page: state.page,
    limit: state.limit,
    id: query.id,
    type: state.quickFilters.stockEntryType,
    sourceWarehouseId: state.quickFilters.sourceWarehouseId,
    destinationWarehouseId: state.quickFilters.targetWarehouseId,
    sortField: query.sort_field,
    sortDirection: query.sort_direction,
    filters: query.filters,
  };
}

export function loadSavedStockEntryFilters(): SavedFilterPreset[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const candidate = entry as Partial<SavedFilterPreset>;
        if (
          typeof candidate.id !== "string" ||
          typeof candidate.name !== "string" ||
          !candidate.state ||
          typeof candidate.state !== "object" ||
          typeof candidate.createdAt !== "string"
        ) {
          return null;
        }

        const safeState = candidate.state as Partial<SavedFilterPreset["state"]>;
        return {
          id: candidate.id,
          name: candidate.name,
          createdAt: candidate.createdAt,
          state: {
            quickFilters: safeState.quickFilters ?? {},
            advancedFilters: normalizeAdvancedFilters((safeState.advancedFilters ?? []) as AdvancedFilter[]),
            sort:
              safeState.sort &&
              typeof safeState.sort === "object" &&
              isSortField((safeState.sort as Partial<SortState>).field ?? null) &&
              isSortDirection((safeState.sort as Partial<SortState>).direction ?? null)
                ? {
                    field: (safeState.sort as SortState).field,
                    direction: (safeState.sort as SortState).direction,
                  }
                : { ...defaultStockEntrySort },
          },
        };
      })
      .filter((entry): entry is SavedFilterPreset => Boolean(entry));
  } catch {
    return [];
  }
}

export function saveCurrentStockEntryFilter(
  name: string,
  state: Pick<StockEntryListState, "quickFilters" | "advancedFilters" | "sort">,
): SavedFilterPreset[] {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return loadSavedStockEntryFilters();
  }

  const nextPreset: SavedFilterPreset = {
    id: globalThis.crypto?.randomUUID?.() ?? `preset-${Date.now()}`,
    name: trimmedName,
    createdAt: new Date().toISOString(),
    state: {
      quickFilters: { ...state.quickFilters },
      advancedFilters: normalizeAdvancedFilters(state.advancedFilters),
      sort: { ...state.sort },
    },
  };

  const next = [nextPreset, ...loadSavedStockEntryFilters()];
  const storage = getStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function applySavedStockEntryFilter(
  current: StockEntryListState,
  preset: SavedFilterPreset,
): StockEntryListState {
  return {
    ...current,
    page: 1,
    quickFilters: { ...preset.state.quickFilters },
    advancedFilters: normalizeAdvancedFilters(preset.state.advancedFilters),
    sort: { ...preset.state.sort },
  };
}
