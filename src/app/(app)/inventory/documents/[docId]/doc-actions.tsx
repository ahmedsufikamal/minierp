"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ActionType = "SUBMIT" | "APPROVE" | "REJECT" | "CANCEL" | "POST";

export function InventoryDocumentActions({
  docId,
  status,
}: {
  docId: string;
  status: string;
}) {
  const [loading, setLoading] = useState<ActionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (action: ActionType) => {
    setLoading(action);
    setError(null);

    const response = await fetch(`/api/v1/inventory/documents/${docId}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        idempotencyKey: action === "POST" ? crypto.randomUUID() : undefined,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
    if (!response.ok || !body.ok) {
      setError(body.error?.message || `Failed to ${action.toLowerCase()} document`);
      setLoading(null);
      return;
    }

    window.location.reload();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <Button size="sm" onClick={() => void runAction("SUBMIT")} disabled={loading != null}>
            Submit
          </Button>
        )}

        {status === "SUBMITTED" && (
          <>
            <Button size="sm" onClick={() => void runAction("APPROVE")} disabled={loading != null}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => void runAction("REJECT")} disabled={loading != null}>
              Reject
            </Button>
          </>
        )}

        {(status === "DRAFT" || status === "SUBMITTED" || status === "APPROVED") && (
          <Button size="sm" variant="outline" onClick={() => void runAction("CANCEL")} disabled={loading != null}>
            Cancel
          </Button>
        )}

        {status === "APPROVED" && (
          <Button size="sm" onClick={() => void runAction("POST")} disabled={loading != null}>
            Post (Idempotent)
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
