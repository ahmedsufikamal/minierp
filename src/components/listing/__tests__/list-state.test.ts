import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applySavedStockEntryFilter,
  createDefaultStockEntryListState,
  loadSavedStockEntryFilters,
  parseStockEntryListState,
  saveCurrentStockEntryFilter,
  toStockEntryListSearchParams,
} from "@/components/listing/list-state";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const originalWindow = globalThis.window;

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: new MemoryStorage(),
    },
    configurable: true,
  });
});

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
    });
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
});

describe("stock entry list state", () => {
  it("parses URL params into list state and preserves supported sort values", () => {
    const searchParams = new URLSearchParams({
      page: "2",
      limit: "50",
      id: "STE-0001",
      stock_entry_type: "TRANSFER",
      source_warehouse_id: "wh-source",
      target_warehouse_id: "wh-target",
      sort_field: "stock_entry_type",
      sort_direction: "asc",
      filters: JSON.stringify([
        { field: "status", op: "equals", value: "POSTED" },
        { field: "id", op: "contains", value: "STE" },
      ]),
    });

    const state = parseStockEntryListState(searchParams);

    expect(state).toEqual({
      page: 2,
      limit: 50,
      quickFilters: {
        id: "STE-0001",
        stockEntryType: "TRANSFER",
        sourceWarehouseId: "wh-source",
        targetWarehouseId: "wh-target",
      },
      advancedFilters: [
        { field: "status", op: "equals", value: "POSTED" },
        { field: "id", op: "contains", value: "STE" },
      ],
      sort: {
        field: "stock_entry_type",
        direction: "asc",
      },
    });
  });

  it("serializes list state and safely ignores invalid advanced filter JSON", () => {
    const invalidState = parseStockEntryListState(
      new URLSearchParams({
        filters: "{not-json}",
        sort_field: "id",
      }),
    );

    expect(invalidState.advancedFilters).toEqual([]);
    expect(invalidState.sort).toEqual({
      field: "id",
      direction: "asc",
    });

    const params = toStockEntryListSearchParams({
      ...invalidState,
      page: 3,
      quickFilters: {
        id: "STE-0021",
        stockEntryType: "RECEIPT",
        sourceWarehouseId: "wh-1",
        targetWarehouseId: "wh-2",
      },
      advancedFilters: [{ field: "status", op: "equals", value: "APPROVED" }],
    });

    expect(params.get("page")).toBe("3");
    expect(params.get("id")).toBe("STE-0021");
    expect(params.get("stock_entry_type")).toBe("RECEIPT");
    expect(params.get("source_warehouse_id")).toBe("wh-1");
    expect(params.get("target_warehouse_id")).toBe("wh-2");
    expect(params.get("sort_field")).toBe("id");
    expect(params.get("sort_direction")).toBe("asc");
    expect(params.get("filters")).toBe(
      JSON.stringify([{ field: "status", op: "equals", value: "APPROVED" }]),
    );
  });

  it("saves, loads, and reapplies local saved filters", () => {
    expect(loadSavedStockEntryFilters()).toEqual([]);

    const saved = saveCurrentStockEntryFilter("My transfer view", {
      quickFilters: {
        stockEntryType: "TRANSFER",
        sourceWarehouseId: "wh-source",
      },
      advancedFilters: [{ field: "status", op: "equals", value: "POSTED" }],
      sort: {
        field: "last_updated_on",
        direction: "desc",
      },
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe("My transfer view");

    const loaded = loadSavedStockEntryFilters();
    expect(loaded).toHaveLength(1);

    const applied = applySavedStockEntryFilter(createDefaultStockEntryListState(), loaded[0]!);
    expect(applied.page).toBe(1);
    expect(applied.quickFilters.stockEntryType).toBe("TRANSFER");
    expect(applied.quickFilters.sourceWarehouseId).toBe("wh-source");
    expect(applied.advancedFilters).toEqual([
      { field: "status", op: "equals", value: "POSTED" },
    ]);
    expect(applied.sort).toEqual({
      field: "last_updated_on",
      direction: "desc",
    });
  });
});
