"use client";

import { useState } from "react";

type VarianceRow = {
  itemId: string;
  warehouseId: string;
  locationId: string | null;
  onHand: number;
  ledgerQty: number;
  qtyDelta: number;
  layerQty: number | null;
  layerDelta: number | null;
};

type VarianceResponse = {
  generatedAt: string;
  fifoEnabled: boolean;
  totalRows: number;
  mismatchCount: number;
  rows: VarianceRow[];
};

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export function VarianceReportClient() {
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [includeZeroDelta, setIncludeZeroDelta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VarianceResponse | null>(null);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/inventory/admin/variance-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemId: itemId.trim() || undefined,
          warehouseId: warehouseId.trim() || undefined,
          locationId: locationId.trim() || undefined,
          includeZeroDelta,
        }),
      });
      const body = (await response.json().catch(() => null)) as Envelope<VarianceResponse> | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body && !body.ok ? (body.error?.message ?? "Failed to run variance report") : "Failed to run variance report");
      }
      setResult(body.data);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to run variance report");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface-1 p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Item ID</span>
          <input
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Warehouse ID</span>
          <input
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Location ID</span>
          <input
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm mt-6">
          <input
            type="checkbox"
            checked={includeZeroDelta}
            onChange={(event) => setIncludeZeroDelta(event.target.checked)}
          />
          Include zero delta rows
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void runReport()}
          className="h-9 rounded-md border border-primary bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Running..." : "Run Variance Report"}
        </button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Generated: {new Date(result.generatedAt).toLocaleString()}</span>
            <span>FIFO Enabled: {result.fifoEnabled ? "Yes" : "No"}</span>
            <span>Total Rows: {result.totalRows}</span>
            <span>Mismatches: {result.mismatchCount}</span>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">On Hand</th>
                  <th className="px-3 py-2">Ledger Qty</th>
                  <th className="px-3 py-2">Qty Delta</th>
                  <th className="px-3 py-2">Layer Qty</th>
                  <th className="px-3 py-2">Layer Delta</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={`${row.itemId}:${row.warehouseId}:${row.locationId ?? "~"}`} className="border-t border-border">
                    <td className="px-3 py-2">{row.itemId}</td>
                    <td className="px-3 py-2">{row.warehouseId}</td>
                    <td className="px-3 py-2">{row.locationId ?? "-"}</td>
                    <td className="px-3 py-2">{row.onHand}</td>
                    <td className="px-3 py-2">{row.ledgerQty}</td>
                    <td className="px-3 py-2">{row.qtyDelta}</td>
                    <td className="px-3 py-2">{row.layerQty ?? "-"}</td>
                    <td className="px-3 py-2">{row.layerDelta ?? "-"}</td>
                  </tr>
                ))}
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No variance rows for selected scope.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

