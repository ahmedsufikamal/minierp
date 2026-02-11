"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBill, deleteBill, updateBillStatus } from "./actions";
import { formatMoney } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SortableTh } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";

type Vendor = { id: string; name: string };
type Product = { id: string; sku: string; name: string; uom: string; priceCents: number };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

type LineState = {
  productId?: string;
  description: string;
  qty: number;
  unitPrice: number;
};

function moneyToCents(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100);
}

export function NewBillCard({ vendors, products }: { vendors: Vendor[]; products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LineState[]>([
    { description: "Expense / Item", qty: 1, unitPrice: 0 },
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
          <div className="font-medium">Create bill</div>
          <div className="text-sm text-slate-600">Add vendor + line items.</div>
        </div>
        <Button
          id="add-bill"
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "New"}
        </Button>
      </div>

      {open ? (
        <form
          action={async (formData: FormData) => {
            await createBill(formData);
          }}
          className="mt-4 grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              name="number"
              placeholder="BILL-0001"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
            <select
              name="vendorId"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select vendor
              </option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              name="billDate"
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
                <Button
                  type="button"
                  variant="utility"
                  size="xs"
                  onClick={() =>
                    setLines((prev) => [...prev, { description: "", qty: 1, unitPrice: 0 }])
                  }
                >
                  Add line
                </Button>

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
            <SubmitButton label="Create bill" />
          </div>

          {vendors.length === 0 ? (
            <p className="text-xs text-amber-700">You need at least 1 vendor to create a bill.</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

const BILL_STATUSES = ["DRAFT", "RECEIVED", "PAID", "VOID"] as const;

export function BillStatusSelect({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={currentStatus}
      disabled={pending}
      className="rounded-lg border px-2 py-1 text-xs bg-white disabled:opacity-60"
      onChange={(e) => {
        const status = e.target.value;
        if (!BILL_STATUSES.includes(status as (typeof BILL_STATUSES)[number])) return;
        startTransition(async () => {
          const formData = new FormData();
          formData.set("status", status);
          const res = await updateBillStatus(id, formData);
          if (res.ok) {
            toast.success("Status updated");
            router.refresh();
          } else {
            toast.error(typeof res.error === "string" ? res.error : "Failed to update");
          }
        });
      }}
    >
      {BILL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function BillTableHead({
  sort,
  order,
}: {
  sort?: string;
  order?: "asc" | "desc";
}) {
  return (
    <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
      <SortableTh sortKey="number" label="Number" currentSort={sort} currentOrder={order} />
      <th scope="col" className="px-4 py-3">Vendor</th>
      <th scope="col" className="px-4 py-3">Status</th>
      <th scope="col" className="px-4 py-3">Total</th>
      <th scope="col" className="w-[90px] px-4 py-3">Action</th>
    </tr>
  );
}

export function DeleteRowButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const handleDelete = async () => {
    setPending(true);
    const res = await deleteBill(id);
    setPending(false);
    if (res.ok) {
      toast.success("Bill deleted");
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to delete");
    }
  };
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={pending}
        variant="utility"
        size="xs"
      >
        {pending ? "..." : "Delete"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete bill?"
        description={`Are you sure you want to delete bill ${label}? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        pending={pending}
      />
    </>
  );
}
