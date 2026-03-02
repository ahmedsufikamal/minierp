"use client";

import { useState, useTransition } from "react";
import { createMove, deleteMove } from "./actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Product = { id: string; sku: string; name: string; uom: string };

export function NewMoveCard({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Legacy Inventory Move (Deprecated)</div>
          <div className="text-sm text-muted-foreground">Direct move writes are disabled. Use stock documents for postings.</div>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "New"}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p>
            This action has been retired to preserve immutable stock ledger rules.
          </p>
          <p>Catalog size: {products.length} products remain available through stock documents.</p>
          <p>
            Use <Link className="text-primary underline" href="/stock/documents">Stock Documents</Link> for all stock
            receipts, issues, transfers, and adjustments.
          </p>
          <form
            action={async (formData: FormData) => {
              await createMove(formData);
            }}
            className="hidden"
          />
        </div>
      ) : null}
    </div>
  );
}

export function DeleteRowButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      onClick={() =>
        start(() => {
          void deleteMove(id);
        })
      }
      disabled={pending}
      variant="utility"
      size="xs"
    >
      {pending ? "..." : "Delete"}
    </Button>
  );
}
