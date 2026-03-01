"use client";

import { ArrowUpDown, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  type SortState,
  labelForSortField,
  stockEntrySortOptions,
} from "@/components/listing/list-types";

interface SortMenuProps {
  value: SortState;
  onChange: (next: SortState) => void;
}

export function SortMenu({ value, onChange }: SortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="rounded-xl">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {labelForSortField(value)}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated pointer-events-auto"
      >
        {stockEntrySortOptions.map((option) => (
          <DropdownMenuItem
            key={`${option.label}-${option.field ?? "disabled"}`}
            disabled={option.disabled}
            onSelect={() => {
              if (!option.field || !option.direction) return;
              onChange({
                field: option.field,
                direction: option.direction,
              });
            }}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
