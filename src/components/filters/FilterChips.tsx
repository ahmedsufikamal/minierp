"use client";

import { X } from "lucide-react";

type Chip = { key: string; label: string };

export function FilterChips({ chips, onRemove }: { chips: Chip[]; onRemove: (key: string) => void }) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          className="focus-ring inline-flex items-center gap-1 rounded-full border border-border bg-[hsl(var(--surface-3))] px-2.5 py-1 text-xs"
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
