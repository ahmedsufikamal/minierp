"use client";

import { useEffect, useState } from "react";

type ClosingRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

type JobsEnvelope = {
  jobs: Array<{ id: string; jobType: string; status: string; updatedAt: string }>;
  closings: ClosingRow[];
};

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export function StockClosingAdminClient() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ClosingRow[]>([]);

  const loadRows = async () => {
    const response = await fetch("/api/v1/inventory/admin/jobs?take=100", { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as Envelope<JobsEnvelope> | null;
    if (!response.ok || !body?.ok) return;
    setRows(body.data.closings);
  };

  useEffect(() => {
    void loadRows();
    const timer = window.setInterval(() => {
      void loadRows();
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const createClosing = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/inventory/admin/stock-closing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          scope: {
            itemId: itemId.trim() || undefined,
            warehouseId: warehouseId.trim() || undefined,
            locationId: locationId.trim() || undefined,
          },
          reason: reason.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as Envelope<{ closingId: string }> | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body && !body.ok ? (body.error?.message ?? "Failed to enqueue stock closing") : "Failed to enqueue stock closing");
      }
      await loadRows();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to enqueue stock closing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface-1 p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Period Start</span>
          <input
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Period End</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Reason</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Item ID (optional)</span>
          <input
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Warehouse ID (optional)</span>
          <input
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Location ID (optional)</span>
          <input
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void createClosing()}
        disabled={loading || !periodStart || !periodEnd}
        className="h-9 rounded-md border border-primary bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Submitting..." : "Launch Stock Closing"}
      </button>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Closing ID</th>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                <td className="px-3 py-2">
                  {new Date(row.periodStart).toISOString().slice(0, 10)} to {new Date(row.periodEnd).toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{row.completedAt ? new Date(row.completedAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No stock closings yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

