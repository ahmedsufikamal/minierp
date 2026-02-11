"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Columns3, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/utils";

type ItemRow = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  unitCostMinor: number | null;
  isActive: boolean;
  brand: { name: string };
  customFields: Record<string, unknown>;
};

type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  showInList: boolean;
};

type ViewPreset = {
  id: string;
  name: string;
  config: {
    columns?: string[];
    search?: string;
  };
};

const baseColumns = [
  { key: "sku", label: "SKU" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "uom", label: "UOM" },
  { key: "unitCostMinor", label: "Unit Cost" },
  { key: "isActive", label: "Status" },
] as const;

function formatCustomValue(value: unknown): string {
  if (value == null) return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function InventoryItemsWorkbench({
  rows,
  customFieldDefs,
  presets,
}: {
  rows: ItemRow[];
  customFieldDefs: CustomFieldDef[];
  presets: ViewPreset[];
}) {
  const customColumns = useMemo(
    () => customFieldDefs.map((field) => ({ key: `cf:${field.key}`, label: field.label, fieldKey: field.key })),
    [customFieldDefs],
  );

  const defaultColumns = useMemo(() => {
    const visibleCustom = customFieldDefs.filter((field) => field.showInList).map((field) => `cf:${field.key}`);
    return ["sku", "name", "brand", "uom", "unitCostMinor", ...visibleCustom];
  }, [customFieldDefs]);

  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultColumns);
  const [saving, setSaving] = useState(false);

  const allColumns = [...baseColumns, ...customColumns];

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const query = search.toLowerCase();
    return rows.filter((row) => {
      if (row.sku.toLowerCase().includes(query)) return true;
      if (row.name.toLowerCase().includes(query)) return true;
      if (row.brand.name.toLowerCase().includes(query)) return true;
      return Object.values(row.customFields).some((value) => formatCustomValue(value).toLowerCase().includes(query));
    });
  }, [rows, search]);

  const applyPreset = (presetId: string) => {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    setVisibleColumns(preset.config.columns && preset.config.columns.length > 0 ? preset.config.columns : defaultColumns);
    setSearch(preset.config.search ?? "");
  };

  const savePreset = async () => {
    const name = window.prompt("Preset name");
    if (!name) return;

    setSaving(true);
    try {
      await fetch("/api/v1/inventory/view-presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "ITEMS",
          name,
          scope: "USER",
          config: {
            columns: visibleColumns,
            search,
          },
        }),
      });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search items..."
            className="focus-ring h-9 min-w-[260px] rounded-md border border-border bg-[hsl(var(--surface-1))] px-3 text-sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-1 h-4 w-4" /> Columns <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[320px] w-64 overflow-auto">
              {allColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns.includes(column.key)}
                  onCheckedChange={(checked) => {
                    setVisibleColumns((current) => {
                      if (checked) {
                        return current.includes(column.key) ? current : [...current, column.key];
                      }
                      return current.filter((key) => key !== column.key);
                    });
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={savePreset} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save View"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-1))] px-2 text-sm"
            defaultValue=""
            onChange={(event) => applyPreset(event.target.value)}
          >
            <option value="">Load preset</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <Button asChild size="sm">
            <Link href="/inventory/items/new">New Item</Link>
          </Button>
        </div>
      </div>

      <div className="surface-1 overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {allColumns
                  .filter((column) => visibleColumns.includes(column.key))
                  .map((column) => (
                    <th key={column.key} className="px-3 py-2 font-medium">
                      {column.label}
                    </th>
                  ))}
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  {allColumns
                    .filter((column) => visibleColumns.includes(column.key))
                    .map((column) => {
                      if (column.key === "sku") return <td key={column.key} className="px-3 py-2 font-mono text-xs">{row.sku}</td>;
                      if (column.key === "name") return <td key={column.key} className="px-3 py-2">{row.name}</td>;
                      if (column.key === "brand") return <td key={column.key} className="px-3 py-2">{row.brand.name}</td>;
                      if (column.key === "uom") return <td key={column.key} className="px-3 py-2">{row.uom}</td>;
                      if (column.key === "unitCostMinor") {
                        return <td key={column.key} className="px-3 py-2">{formatMoney(row.unitCostMinor ?? 0, "BDT")}</td>;
                      }
                      if (column.key === "isActive") {
                        return (
                          <td key={column.key} className="px-3 py-2">
                            {row.isActive ? "Active" : "Archived"}
                          </td>
                        );
                      }

                      const customField = customColumns.find((entry) => entry.key === column.key);
                      return (
                        <td key={column.key} className="px-3 py-2">
                          {formatCustomValue(customField ? row.customFields[customField.fieldKey] : null)}
                        </td>
                      );
                    })}
                  <td className="px-3 py-2">
                    <Link href={`/inventory/items/${row.id}`} className="text-primary hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
