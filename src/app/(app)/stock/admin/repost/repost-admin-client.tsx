"use client";

import { useEffect, useState } from "react";

type OpsJobRow = {
  id: string;
  jobType: string;
  status: string;
  progressPct: number;
  attempts: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type JobsEnvelope = {
  jobs: OpsJobRow[];
  closings: Array<{ id: string; status: string; periodStart: string; periodEnd: string; createdAt: string }>;
};

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export function RepostAdminClient() {
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<OpsJobRow[]>([]);

  const loadJobs = async () => {
    const response = await fetch("/api/v1/inventory/admin/jobs?take=100", { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as Envelope<JobsEnvelope> | null;
    if (!response.ok || !body?.ok) return;
    setJobs(body.data.jobs.filter((job) => job.jobType === "inventory:repost"));
  };

  useEffect(() => {
    void loadJobs();
    const timer = window.setInterval(() => {
      void loadJobs();
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  const runRepost = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/inventory/admin/repost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          scope: {
            itemId: itemId.trim() || undefined,
            warehouseId: warehouseId.trim() || undefined,
            locationId: locationId.trim() || undefined,
          },
          reason: reason.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as Envelope<OpsJobRow> | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body && !body.ok ? (body.error?.message ?? "Failed to enqueue repost job") : "Failed to enqueue repost job");
      }
      await loadJobs();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to enqueue repost job");
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
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Reason</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void runRepost()}
        disabled={loading}
        className="h-9 rounded-md border border-primary bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Submitting..." : "Launch Repost Job"}
      </button>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Job ID</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{job.id}</td>
                <td className="px-3 py-2">{job.status}</td>
                <td className="px-3 py-2">{job.progressPct}%</td>
                <td className="px-3 py-2">{job.attempts}</td>
                <td className="px-3 py-2">{new Date(job.updatedAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-destructive">{job.error ?? "-"}</td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No repost jobs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

