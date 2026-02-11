"use client";

import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button";

type Tab = { id: string; label: string };

interface SubNavTabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
}

export function SubNavTabs({ tabs, value, onChange }: SubNavTabsProps) {
  return (
    <div className="surface-2 inline-flex w-full items-center gap-1 overflow-auto p-1" role="tablist" aria-label="Report sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={cn(
            buttonVariants({ variant: "utility", size: "sm" }),
            "h-8 whitespace-nowrap rounded-sm border-transparent px-3 shadow-none",
            value === tab.id
              ? "bg-[hsl(var(--surface-3))] text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
