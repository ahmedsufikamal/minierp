"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receivePurchaseOrderLine } from "./actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReceiveLineForm({
  lineId,
  maxQty,
}: {
  lineId: string;
  maxQty: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState(maxQty);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const num = Number(qty);
        if (!Number.isInteger(num) || num <= 0 || num > maxQty) {
          toast.error(`Enter 1–${maxQty}`);
          return;
        }
        start(async () => {
          const res = await receivePurchaseOrderLine(lineId, num);
          if (res.ok) {
            toast.success(`Received ${num}`);
            router.refresh();
          } else {
            toast.error(typeof res.error === "string" ? res.error : "Failed to receive");
          }
        });
      }}
    >
      <input
        type="number"
        min={1}
        max={maxQty}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value) || 0)}
        className="w-16 rounded-lg border px-2 py-1 text-xs"
      />
      <Button
        type="submit"
        disabled={pending}
        variant="utility"
        size="xs"
      >
        {pending ? "..." : "Receive"}
      </Button>
    </form>
  );
}
