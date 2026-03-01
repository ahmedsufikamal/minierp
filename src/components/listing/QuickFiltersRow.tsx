"use client";

import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QuickFilterCombobox } from "@/components/listing/QuickFilterCombobox";
import {
  type QuickFilters,
  type StockEntryTypeFilter,
  type WarehouseOption,
  labelForStockEntryType,
  stockEntryTypeOptions,
} from "@/components/listing/list-types";
import { cn } from "@/lib/utils";

interface QuickFiltersRowProps {
  quickFilters: QuickFilters;
  warehouseOptions: WarehouseOption[];
  onChange: (next: QuickFilters) => void;
}

export function QuickFiltersRow({
  quickFilters,
  warehouseOptions,
  onChange,
}: QuickFiltersRowProps) {
  const setFilter = <K extends keyof QuickFilters>(key: K, value: QuickFilters[K]) => {
    onChange({
      ...quickFilters,
      [key]: value || undefined,
    });
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-2">
        <label
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-[hsl(var(--surface-1))] px-3 text-sm text-foreground shadow-sm",
            "hover:bg-[hsl(var(--surface-2))]",
          )}
        >
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            ID
          </span>
          <input
            value={quickFilters.id ?? ""}
            onChange={(event) => setFilter("id", event.target.value)}
            placeholder="Search ID"
            className="h-8 w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-[hsl(var(--surface-1))] px-3 text-left text-sm text-foreground shadow-sm",
                "hover:bg-[hsl(var(--surface-2))]",
              )}
              aria-label="Stock Entry Type"
            >
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Stock Entry Type
              </span>
              <span className="max-w-[200px] truncate">
                {quickFilters.stockEntryType
                  ? labelForStockEntryType(quickFilters.stockEntryType)
                  : "All Types"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-64 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated pointer-events-auto"
          >
            <DropdownMenuItem onSelect={() => setFilter("stockEntryType", undefined)}>
              All Types
            </DropdownMenuItem>
            {stockEntryTypeOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => setFilter("stockEntryType", option.value as StockEntryTypeFilter)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <QuickFilterCombobox
          label="Default Source Warehouse"
          placeholder="Any warehouse"
          value={quickFilters.sourceWarehouseId}
          options={warehouseOptions}
          onChange={(value) => setFilter("sourceWarehouseId", value)}
        />

        <QuickFilterCombobox
          label="Default Target Warehouse"
          placeholder="Any warehouse"
          value={quickFilters.targetWarehouseId}
          options={warehouseOptions}
          onChange={(value) => setFilter("targetWarehouseId", value)}
        />
      </div>
    </div>
  );
}
