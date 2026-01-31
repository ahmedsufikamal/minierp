"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createMove, deleteMove } from "./actions";

type Product = { id: string; sku: string; name: string; unit: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export function NewMoveCard({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">New inventory move</div>
          <div className="text-sm text-slate-600">Record stock in/out adjustments.</div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          {open ? "Close" : "New"}
        </button>
      </div>

      {open ? (
        <form
          action={async (formData: FormData) => {
            await createMove(formData);
          }}
          className="mt-4 grid gap-3"
        >
          <select
            name="productId"
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select product
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select
              name="type"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              defaultValue="IN"
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="ADJUST">ADJUST</option>
            </select>

            <input
              name="qty"
              placeholder="Qty"
              type="number"
              min={1}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
          </div>

          <input
            name="note"
            placeholder="Note (optional)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />

          <div className="flex justify-end">
            <SubmitButton label="Create move" />
          </div>

          {products.length === 0 ? (
            <p className="text-xs text-amber-700">
              You need at least 1 product to create inventory moves.
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function DeleteRowButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(() => {
          void deleteMove(id);
        })
      }
      disabled={pending}
      className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "..." : "Delete"}
    </button>
  );
}
