"use client";

import { useEffect, useState } from "react";
import { Filter, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  type AdvancedFilter,
  stockEntryAdvancedFilterFieldOptions,
  stockEntryAdvancedFilterOperatorOptions,
} from "@/components/listing/list-types";
import { createEmptyAdvancedFilter, normalizeAdvancedFilters } from "@/components/listing/list-state";

interface AdvancedFilterPopoverProps {
  value: AdvancedFilter[];
  onApply: (filters: AdvancedFilter[]) => void;
  onClear: () => void;
}

export function AdvancedFilterPopover({ value, onApply, onClear }: AdvancedFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilter[]>(
    value.length > 0 ? value : [createEmptyAdvancedFilter()],
  );

  useEffect(() => {
    if (!open) {
      setDraftFilters(value.length > 0 ? value : [createEmptyAdvancedFilter()]);
    }
  }, [open, value]);

  const updateRow = (index: number, next: Partial<AdvancedFilter>) => {
    setDraftFilters((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...next,
            }
          : row,
      ),
    );
  };

  const removeRow = (index: number) => {
    setDraftFilters((current) => {
      if (current.length <= 1) {
        return [createEmptyAdvancedFilter()];
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="rounded-xl">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="w-[min(92vw,720px)] rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-elevated pointer-events-auto"
      >
        <div className="space-y-4">
          {draftFilters.map((filter, index) => (
            <div key={`advanced-filter-${index}`} className="grid gap-2 md:grid-cols-[170px_150px_minmax(0,1fr)_40px]">
              <select
                value={filter.field}
                onChange={(event) =>
                  updateRow(index, {
                    field: event.target.value as AdvancedFilter["field"],
                  })
                }
                className="h-11 rounded-xl border border-border bg-[hsl(var(--surface-1))] px-3 text-sm text-foreground outline-none"
              >
                {stockEntryAdvancedFilterFieldOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filter.op}
                onChange={(event) =>
                  updateRow(index, {
                    op: event.target.value as AdvancedFilter["op"],
                  })
                }
                className="h-11 rounded-xl border border-border bg-[hsl(var(--surface-1))] px-3 text-sm text-foreground outline-none"
              >
                {stockEntryAdvancedFilterOperatorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Input
                value={filter.value}
                onChange={(event) => updateRow(index, { value: event.target.value })}
                placeholder="Value"
                className="h-11 rounded-xl border border-border bg-[hsl(var(--surface-1))] px-3 py-2 shadow-none"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-xl"
                onClick={() => removeRow(index)}
                disabled={draftFilters.length <= 1 && draftFilters[0]?.value.trim().length === 0}
                aria-label="Remove filter row"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            onClick={() => setDraftFilters((current) => [...current, createEmptyAdvancedFilter()])}
          >
            <Plus className="h-4 w-4" />
            Add a Filter
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraftFilters([createEmptyAdvancedFilter()]);
                onClear();
                setOpen(false);
              }}
            >
              Clear Filters
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply(normalizeAdvancedFilters(draftFilters));
                setOpen(false);
              }}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
