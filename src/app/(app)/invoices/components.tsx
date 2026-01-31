"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createInvoice, deleteInvoice } from "./actions";
import { formatMoney } from "@/lib/utils";

type Customer = { id: string; name: string };
type Product = { id: string; sku: string; name: string; unit: string; priceCents: number };

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

type LineState = {
  productId?: string;
  description: string;
  qty: number;
  unitPrice: number; // decimal
};

function moneyToCents(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100);
}

export function NewInvoiceCard({
  customers,
  products,
}: {
  customers: Customer[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LineState[]>([
    { description: "Service / Item", qty: 1, unitPrice: 0 },
  ]);

  const subtotalCents = useMemo(() => {
    return lines.reduce((sum, l) => sum + moneyToCents(l.unitPrice) * l.qty, 0);
  }, [lines]);

  const linesJson = useMemo(() => {
    return JSON.stringify(
      lines
        .filter((l) => l.description.trim().length > 0 && l.qty > 0)
        .map((l) => ({
          productId: l.productId || null,
          description: l.description.trim(),
          qty: Number(l.qty),
          unitPriceCents: moneyToCents(l.unitPrice),
        })),
    );
  }, [lines]);

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Create invoice</div>
          <div className="text-sm text-slate-600">Add customer + line items.</div>
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
            await createInvoice(formData);
          }}
          className="mt-4 grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              name="number"
              placeholder="INV-0001"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
            <select
              name="customerId"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select customer
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              name="issueDate"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              type="date"
              name="dueDate"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl border overflow-hidden">
            <div className="px-3 py-2 text-xs text-slate-600 border-b bg-slate-50">Line items</div>

            <div className="p-3 grid gap-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    className="col-span-4 rounded-lg border px-2 py-2 text-xs bg-white"
                    value={line.productId || ""}
                    onChange={(e) => {
                      const productId = e.target.value || undefined;
                      const p = products.find((x) => x.id === productId);
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx
                            ? {
                                ...l,
                                productId,
                                description: p ? `${p.name} (${p.sku})` : l.description,
                                unitPrice: p ? p.priceCents / 100 : l.unitPrice,
                              }
                            : l,
                        ),
                      );
                    }}
                  >
                    <option value="">(No product)</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>

                  <input
                    className="col-span-4 rounded-lg border px-2 py-2 text-xs"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)),
                      )
                    }
                  />

                  <input
                    type="number"
                    className="col-span-2 rounded-lg border px-2 py-2 text-xs"
                    min={1}
                    value={line.qty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, qty: Number(e.target.value) } : l)),
                      )
                    }
                  />

                  <input
                    type="number"
                    className="col-span-2 rounded-lg border px-2 py-2 text-xs"
                    min={0}
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, unitPrice: Number(e.target.value) } : l,
                        ),
                      )
                    }
                  />
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50"
                  onClick={() =>
                    setLines((prev) => [...prev, { description: "", qty: 1, unitPrice: 0 }])
                  }
                >
                  Add line
                </button>

                <div className="text-sm font-medium">
                  Subtotal: {formatMoney(subtotalCents, "BDT")}
                </div>
              </div>
            </div>
          </div>

          <textarea
            name="notes"
            placeholder="Notes (optional)"
            className="w-full rounded-xl border px-3 py-2 text-sm min-h-[80px]"
          />

          <input type="hidden" name="linesJson" value={linesJson} />

          <div className="flex justify-end">
            <SubmitButton label="Create invoice" />
          </div>

          {customers.length === 0 ? (
            <p className="text-xs text-amber-700">
              You need at least 1 customer to create an invoice.
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
          void deleteInvoice(id);
        })
      }
      disabled={pending}
      className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "..." : "Delete"}
    </button>
  );
}
