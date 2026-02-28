"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RolesGridGroup = {
  module: string;
  permissions: Array<{ key: string; description: string }>;
};

interface RolesGridProps {
  groups: RolesGridGroup[];
  selectedKeys: string[];
  disabled?: boolean;
  onChange: (keys: string[]) => void;
}

export function RolesGrid({ groups, selectedKeys, disabled = false, onChange }: RolesGridProps) {
  const selected = new Set(selectedKeys);
  const allKeys = groups.flatMap((group) => group.permissions.map((permission) => permission.key));

  const toggle = (key: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next).sort());
  };

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(Array.from(new Set(allKeys)).sort())}>
          Select All
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}>
          Unselect All
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.module} className="rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-4">
            <h3 className="mb-3 text-sm font-semibold capitalize text-foreground">{group.module}</h3>
            <div className="space-y-2">
              {group.permissions.map((permission) => {
                const checked = selected.has(permission.key);
                return (
                  <label
                    key={permission.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-2 text-sm transition-colors",
                      checked && "border-border bg-card",
                      disabled && "cursor-not-allowed opacity-70",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(permission.key)}
                    />
                    <span>
                      <span className="block font-medium text-foreground">{permission.key}</span>
                      <span className="block text-xs text-muted-foreground">{permission.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
