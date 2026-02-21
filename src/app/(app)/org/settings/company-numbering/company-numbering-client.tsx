"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CompanyCodeFormatKey =
  | "SKU"
  | "QUOTATION"
  | "DELIVERY_CHALLAN"
  | "INVOICE"
  | "SPOT_SALE"
  | "BUDGETARY";

type ResetPolicy = "NEVER" | "FISCAL_YEAR" | "CALENDAR_YEAR" | "MONTHLY";

type NumberingRow = {
  key: CompanyCodeFormatKey;
  name: string;
  pattern: string;
  resetPolicy: ResetPolicy;
  startAt: number;
  padding: number;
  isActive: boolean;
};

type ApiError = {
  ok: false;
  error?: { code?: string; message?: string };
};

type ApiResponse = {
  ok: true;
  data: {
    companyId: string;
    formats: NumberingRow[];
  };
};

const resetPolicyOptions: Array<{ value: ResetPolicy; label: string }> = [
  { value: "NEVER", label: "Never" },
  { value: "FISCAL_YEAR", label: "Fiscal Year" },
  { value: "CALENDAR_YEAR", label: "Calendar Year" },
  { value: "MONTHLY", label: "Monthly" },
];

export function CompanyNumberingClient({ canManage }: { canManage: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rows, setRows] = useState<NumberingRow[]>([]);
  const [previewByKey, setPreviewByKey] = useState<Record<string, string>>({});

  const hasRows = rows.length > 0;
  const readOnlyReason = useMemo(() => {
    if (canManage) return null;
    return "Read-only: only active Master Admin (OWNER) can manage company numbering.";
  }, [canManage]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/v1/platform/company-numbering", {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse | ApiError;
      if (cancelled) return;

      if (!response.ok || !("ok" in body) || !body.ok) {
        setError(body && "error" in body ? body.error?.message ?? "Failed to load company numbering." : "Failed to load company numbering.");
        setRows([]);
      } else {
        setRows(body.data.formats);
      }

      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setRow = (key: CompanyCodeFormatKey, patch: Partial<NumberingRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const runPreview = async (row: NumberingRow) => {
    setError(null);
    const response = await fetch("/api/v1/platform/company-numbering/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: row.key,
        pattern: row.pattern,
        resetPolicy: row.resetPolicy,
        padding: row.padding,
        sequence: row.startAt,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as
      | { ok: true; data: { preview: string } }
      | ApiError;

    if (!response.ok || !("ok" in body) || !body.ok) {
      setError(body && "error" in body ? body.error?.message ?? "Preview failed." : "Preview failed.");
      return;
    }

    setPreviewByKey((current) => ({
      ...current,
      [row.key]: body.data.preview,
    }));
  };

  const save = async () => {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/v1/platform/company-numbering", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        formats: rows.map((row) => ({
          key: row.key,
          pattern: row.pattern,
          resetPolicy: row.resetPolicy,
          startAt: row.startAt,
          padding: row.padding,
          isActive: row.isActive,
        })),
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ApiResponse | ApiError;
    if (!response.ok || !("ok" in body) || !body.ok) {
      setError(body && "error" in body ? body.error?.message ?? "Save failed." : "Save failed.");
      setSaving(false);
      return;
    }

    setRows(body.data.formats);
    setSuccess("Company numbering updated.");
    setSaving(false);
  };

  if (loading) {
    return <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading company numbering…</div>;
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {readOnlyReason ? <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{readOnlyReason}</p> : null}
      {error ? <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

      {!hasRows ? (
        <p className="text-sm text-muted-foreground">No numbering rows found for this company.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-[hsl(var(--surface-elevated))] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2">
                <th>Format key</th>
                <th>Pattern</th>
                <th>Reset</th>
                <th>Start</th>
                <th>Padding</th>
                <th>Active</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.pattern}
                      disabled={!canManage || saving}
                      onChange={(event) => setRow(row.key, { pattern: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="h-9 rounded-md border border-border bg-background px-2"
                      value={row.resetPolicy}
                      disabled={!canManage || saving}
                      onChange={(event) => setRow(row.key, { resetPolicy: event.target.value as ResetPolicy })}
                    >
                      {resetPolicyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      value={row.startAt}
                      disabled={!canManage || saving}
                      onChange={(event) => setRow(row.key, { startAt: Number(event.target.value || 1) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={row.padding}
                      disabled={!canManage || saving}
                      onChange={(event) => setRow(row.key, { padding: Number(event.target.value || 1) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        disabled={!canManage || saving}
                        onChange={(event) => setRow(row.key, { isActive: event.target.checked })}
                      />
                      Enabled
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => runPreview(row)} disabled={saving}>
                        Preview
                      </Button>
                      <div className="font-mono text-xs text-muted-foreground break-all">
                        {previewByKey[row.key] ?? "—"}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={!canManage || saving || !hasRows}>
          {saving ? "Saving..." : "Save company numbering"}
        </Button>
      </div>
    </div>
  );
}
