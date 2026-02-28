"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SessionsTable, type SessionTableItem } from "@/components/records/sessions-table";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as Envelope<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Request failed" : payload.error.message);
  }
  return payload.data;
}

export function SessionsSettingsClient() {
  const queryClient = useQueryClient();
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const sessionsQuery = useQuery({
    queryKey: ["iam-me-sessions"],
    queryFn: async () => readEnvelope<{ sessions: SessionTableItem[] }>(await fetch("/api/iam/me/sessions", { cache: "no-store" })),
  });

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      setPendingSessionId(sessionId);
      const response = await fetch(`/api/iam/me/sessions/${sessionId}/revoke`, {
        method: "POST",
        credentials: "same-origin",
      });
      return readEnvelope<{ revoked: boolean }>(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["iam-me-sessions"] });
    },
    onSettled: () => setPendingSessionId(null),
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sessions/revoke-all", {
        method: "POST",
        credentials: "same-origin",
      });
      return readEnvelope<{ revoked: boolean }>(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["iam-me-sessions"] });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Settings / User / Sessions</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sessions</h1>
          <p className="text-sm text-muted-foreground">Review active devices and revoke access that should no longer persist.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => revokeAllMutation.mutate()} disabled={revokeAllMutation.isPending}>
          {revokeAllMutation.isPending ? "Revoking..." : "Revoke All"}
        </Button>
      </div>

      <SessionsTable
        sessions={sessionsQuery.data?.sessions ?? []}
        emptyLabel={sessionsQuery.isLoading ? "Loading sessions..." : "No active sessions."}
        revokePendingId={pendingSessionId}
        onRevoke={(sessionId) => revokeMutation.mutate(sessionId)}
      />
    </div>
  );
}
