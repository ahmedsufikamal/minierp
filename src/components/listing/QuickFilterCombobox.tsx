"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { WarehouseOption } from "@/components/listing/list-types";
import { cn } from "@/lib/utils";

interface QuickFilterComboboxProps {
  label: string;
  placeholder: string;
  value?: string;
  options: WarehouseOption[];
  onChange: (value?: string) => void;
}

export function QuickFilterCombobox({
  label,
  placeholder,
  value,
  options,
  onChange,
}: QuickFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.trim().toLowerCase();
    return options.filter((option) =>
      `${option.code} ${option.name}`.toLowerCase().includes(query),
    );
  }, [options, search]);

  const selected = options.find((option) => option.id === value);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-[hsl(var(--surface-1))] px-3 text-left text-sm text-foreground shadow-sm",
            "hover:bg-[hsl(var(--surface-2))]",
          )}
          aria-label={label}
        >
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <span className="max-w-[220px] truncate">
            {selected ? `${selected.code} · ${selected.name}` : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="w-72 rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-elevated pointer-events-auto"
      >
        <Command className="bg-popover">
          <CommandInput
            placeholder={`Search ${label.toLowerCase()}...`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No warehouse found.</CommandEmpty>
            <CommandGroup heading="Warehouses">
              <CommandItem
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                {!selected ? <Check className="h-4 w-4 text-primary" /> : <span className="h-4 w-4" />}
                Clear selection
              </CommandItem>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  {value === option.id ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.code}</span>
                    <span className="block truncate text-xs text-muted-foreground">{option.name}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => setOpen(false)}>
                <Plus className="h-4 w-4" />
                + Create a new Warehouse
              </CommandItem>
              <CommandItem onSelect={() => setOpen(false)}>
                <Search className="h-4 w-4" />
                Advanced Search
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
