"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Rule = {
  id: string;
  item: { id: string; sku: string; name: string };
  warehouse: { id: string; code: string; name: string };
  reorderPoint: number;
  reorderQty: number;
  minQty: number;
  maxQty: number;
  leadTimeDays: number;
};

type ItemOption = { id: string; sku: string; name: string };
type WarehouseOption = { id: string; code: string; name: string };

export function ReorderClient({
  rules,
  suggestions,
  items,
  warehouses,
}: {
  rules: Rule[];
  suggestions: Array<{
    ruleId: string;
    sku: string;
    itemName: string;
    warehouseName: string;
    availableQty: number;
    reorderPoint: number;
    suggestedQty: number;
  }>;
  items: ItemOption[];
  warehouses: WarehouseOption[];
}) {
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const createRule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);

    await fetch("/api/v1/inventory/reorder-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemId: String(form.get("itemId") || ""),
        warehouseId: String(form.get("warehouseId") || ""),
        minQty: Number(form.get("minQty") || 0),
        maxQty: Number(form.get("maxQty") || 0),
        reorderPoint: Number(form.get("reorderPoint") || 0),
        reorderQty: Number(form.get("reorderQty") || 0),
        leadTimeDays: Number(form.get("leadTimeDays") || 0),
        isActive: true,
      }),
    });

    window.location.reload();
  };

  const refreshSuggestions = async () => {
    setRunning(true);
    await fetch("/api/v1/inventory/reorder-suggestions");
    window.location.reload();
  };

  const deleteRule = async (ruleId: string) => {
    await fetch(`/api/v1/inventory/reorder-rules/${ruleId}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={createRule} className="surface-1 grid gap-2 p-4 sm:grid-cols-7">
        <select name="itemId" required className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
          <option value="">Select item</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>
          ))}
        </select>

        <select name="warehouseId" required className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
          <option value="">Select warehouse</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>{warehouse.code}</option>
          ))}
        </select>

        <input name="minQty" type="number" defaultValue={0} placeholder="Min" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="maxQty" type="number" defaultValue={0} placeholder="Max" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="reorderPoint" type="number" defaultValue={0} placeholder="ROP" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="reorderQty" type="number" defaultValue={0} placeholder="ROQ" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add Rule"}</Button>
      </form>

      <section className="surface-1 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Reorder Suggestions</h2>
          <Button variant="outline" size="sm" onClick={refreshSuggestions} disabled={running}>
            {running ? "Running..." : "Run Suggestions"}
          </Button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">SKU</th>
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">Warehouse</th>
                <th className="px-2 py-1.5">Available</th>
                <th className="px-2 py-1.5">ROP</th>
                <th className="px-2 py-1.5">Suggested Qty</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => (
                <tr key={suggestion.ruleId} className="border-t border-border">
                  <td className="px-2 py-1.5 font-mono text-xs">{suggestion.sku}</td>
                  <td className="px-2 py-1.5">{suggestion.itemName}</td>
                  <td className="px-2 py-1.5">{suggestion.warehouseName}</td>
                  <td className="px-2 py-1.5">{suggestion.availableQty}</td>
                  <td className="px-2 py-1.5">{suggestion.reorderPoint}</td>
                  <td className="px-2 py-1.5 font-medium">{suggestion.suggestedQty}</td>
                </tr>
              ))}
              {suggestions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-muted-foreground">No reorder suggestions right now.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-1 p-4">
        <h2 className="mb-2 text-sm font-semibold">Configured Rules</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">SKU</th>
                <th className="px-2 py-1.5">Warehouse</th>
                <th className="px-2 py-1.5">Min</th>
                <th className="px-2 py-1.5">Max</th>
                <th className="px-2 py-1.5">ROP</th>
                <th className="px-2 py-1.5">ROQ</th>
                <th className="px-2 py-1.5">Lead Time</th>
                <th className="px-2 py-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-border">
                  <td className="px-2 py-1.5 font-mono text-xs">{rule.item.sku}</td>
                  <td className="px-2 py-1.5">{rule.warehouse.code}</td>
                  <td className="px-2 py-1.5">{rule.minQty}</td>
                  <td className="px-2 py-1.5">{rule.maxQty}</td>
                  <td className="px-2 py-1.5">{rule.reorderPoint}</td>
                  <td className="px-2 py-1.5">{rule.reorderQty}</td>
                  <td className="px-2 py-1.5">{rule.leadTimeDays}</td>
                  <td className="px-2 py-1.5">
                    <Button size="sm" variant="ghost" onClick={() => void deleteRule(rule.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-muted-foreground">No reorder rules configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
