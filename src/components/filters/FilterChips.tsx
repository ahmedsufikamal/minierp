"use client";

import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          className={cn(
            buttonVariants({ variant: "utility", size: "xs" }),
            "rounded-full bg-[hsl(var(--surface-3))] px-2.5",
          )}
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
