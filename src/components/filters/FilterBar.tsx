"use client";

import { useMemo } from "react";
import { addMonths, endOfMonth, formatISO, startOfMonth, startOfYear } from "date-fns";
import { Button } from "@/components/ui/button";

type DateRange = { from: string; to: string };

interface FilterBarProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  onOpenMoreFilters: () => void;
  onReset: () => void;
}

export function FilterBar({ range, onChange, onOpenMoreFilters, onReset }: FilterBarProps) {
  const presets = useMemo(() => {
    const now = new Date();
    return [
      { id: "this-month", label: "This month", from: startOfMonth(now), to: endOfMonth(now) },
      { id: "last-3-months", label: "Last 3 months", from: startOfMonth(addMonths(now, -2)), to: endOfMonth(now) },
      { id: "ytd", label: "YTD", from: startOfYear(now), to: now },
    ];
  }, []);

  return (
    <div className="surface-2 flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange({ from: formatISO(preset.from, { representation: "date" }), to: formatISO(preset.to, { representation: "date" }) })}
          >
            {preset.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={onOpenMoreFilters}>More filters</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onReset}>Reset</Button>
      </div>
      <div className="grid gap-2 md:grid-cols-[200px_200px_auto]">
        <label className="grid gap-1 text-xs text-muted-foreground">
          From
          <input
            type="date"
            value={range.from}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
            className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-1))] px-2 text-sm text-foreground"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          To
          <input
            type="date"
            value={range.to}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
            className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-1))] px-2 text-sm text-foreground"
          />
        </label>
      </div>
    </div>
  );
}
