"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, ApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LCTable } from "@/components/trade/lc/lc-table";

type SettingsData = {
  settings: {
    dualControlEnabled: boolean;
    expiringSoonDays: number;
    maturitySoonDays: number;
  };
  counts: Record<string, number>;
};

function MasterSection({
  title,
  endpoint,
}: {
  title: string;
  endpoint: string;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.list("trade", endpoint, {}),
    queryFn: () => apiGet<Array<Record<string, unknown>>>(endpoint),
  });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => apiPost(endpoint, { code, name }),
    onSuccess: async () => {
      setCode("");
      setName("");
      setError(null);
      await client.invalidateQueries({ queryKey: queryKeys.module("trade") });
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create record");
      }
    },
  });

  const columns = useMemo(() => {
    const first = query.data?.[0];
    if (!first) {
      return [
        { key: "code", label: "Code", render: () => "—" },
        { key: "name", label: "Name", render: () => "—" },
      ];
    }

    return ["code", "name", "isActive"].map((key) => ({
      key,
      label: key,
      render: (row: Record<string, unknown>) => {
        const value = row[key];
        if (value === null || value === undefined) return "—";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        return String(value);
      },
    }));
  }, [query.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <Button type="button" onClick={() => createMutation.mutate()} disabled={!code || !name || createMutation.isPending}>
            Add
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <LCTable rows={(query.data ?? []) as Array<any>} columns={columns as any} emptyLabel={query.isLoading ? "Loading..." : "No rows."} />
      </CardContent>
    </Card>
  );
}

export function LCSettingsClient() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const settings = useQuery({
    queryKey: queryKeys.detail("trade", "lc-settings", "singleton"),
    queryFn: () => apiGet<SettingsData>("/api/v1/trade/lc/settings"),
  });

  const [dualControlEnabled, setDualControlEnabled] = useState(true);
  const [expiringSoonDays, setExpiringSoonDays] = useState("30");
  const [maturitySoonDays, setMaturitySoonDays] = useState("15");

  useEffect(() => {
    if (settings.data?.settings) {
      setDualControlEnabled(settings.data.settings.dualControlEnabled);
      setExpiringSoonDays(String(settings.data.settings.expiringSoonDays));
      setMaturitySoonDays(String(settings.data.settings.maturitySoonDays));
    }
  }, [settings.data]);

  const patchMutation = useMutation({
    mutationFn: () =>
      apiPatch("/api/v1/trade/lc/settings", {
        dualControlEnabled,
        expiringSoonDays: Number(expiringSoonDays),
        maturitySoonDays: Number(maturitySoonDays),
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.module("trade") });
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to update settings");
      }
    },
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LC Controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="dualControlEnabled">Dual Control</Label>
            <select
              id="dualControlEnabled"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={dualControlEnabled ? "true" : "false"}
              onChange={(e) => setDualControlEnabled(e.target.value === "true")}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expiringSoonDays">Expiring Soon Days</Label>
            <Input id="expiringSoonDays" value={expiringSoonDays} onChange={(e) => setExpiringSoonDays(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="maturitySoonDays">Maturity Soon Days</Label>
            <Input id="maturitySoonDays" value={maturitySoonDays} onChange={(e) => setMaturitySoonDays(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => patchMutation.mutate()} disabled={patchMutation.isPending}>
              Save Settings
            </Button>
          </div>
        </CardContent>
        {error ? <CardContent className="pt-0 text-sm text-destructive">{error}</CardContent> : null}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <MasterSection title="Banks" endpoint="/api/v1/trade/lc/settings/banks" />
        <MasterSection title="Document Types" endpoint="/api/v1/trade/lc/settings/document-types" />
        <MasterSection title="Charge Types" endpoint="/api/v1/trade/lc/settings/charge-types" />
        <MasterSection title="Incoterms" endpoint="/api/v1/trade/lc/settings/incoterms" />
      </div>
    </div>
  );
}
