"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost, ApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { LCForm } from "@/components/trade/lc/lc-form";

type CreateResponse = {
  lc: { id: string };
};

export function LCNewClient() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useQuery({
    queryKey: queryKeys.detail("trade", "lc-form-options", "singleton"),
    queryFn: () => apiGet<Record<string, unknown>>("/api/v1/trade/lc/form-options"),
  });

  async function create(payload: Record<string, unknown>, submitAfter = false) {
    setPending(true);
    setError(null);
    try {
      const created = await apiPost<CreateResponse, Record<string, unknown>>("/api/v1/trade/lc", payload);
      if (submitAfter) {
        await apiPost(`/api/v1/trade/lc/${created.lc.id}/submit`, {});
      }
      router.push(`/trade/lc/${created.lc.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create LC");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <LCForm
      options={(options.data ?? {}) as any}
      pending={pending || options.isLoading}
      error={error}
      submitLabel="Save Draft"
      secondaryLabel="Save & Submit"
      onSubmit={(payload) => create(payload, false)}
      onSecondarySubmit={(payload) => create(payload, true)}
    />
  );
}
