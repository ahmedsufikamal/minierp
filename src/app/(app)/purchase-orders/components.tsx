"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createPurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
  convertPurchaseOrderToBill,
} from "./actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SortableTh } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { toast } from "sonner";

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

const PO_STATUSES = ["DRAFT", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;

export function NewPOCard({ vendors, products }: { vendors: Vendor[]; products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lines, setLines] = useState<LineState[]>([{ description: "Item", qty: 1, unitPrice: 0 }]);

  const linesJson = useMemo(
    () =>
      JSON.stringify(
        lines
          .filter((l) => l.description.trim().length > 0 && l.qty > 0)
          .map((l) => ({
            productId: l.productId || null,
            description: l.description.trim(),
            qty: Number(l.qty),
            unitPriceCents: moneyToCents(l.unitPrice),
          })),
      ),
    [lines],
  );

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Create purchase order</div>
          <div className="text-sm text-slate-600">Vendor and line items.</div>
        </div>
        <Button
          id="add-po"
          type="button"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "New"}
        </Button>
      </div>

      {open ? (
        <form
          action={async (formData: FormData) => {
            setFormError(null);
            const res = await createPurchaseOrder(formData);
            if (res.ok) {
              toast.success("Purchase order created");
              setOpen(false);
              router.refresh();
            } else {
              const err = res.error;
              setFormError(typeof err === "string" ? err : "Please fix the errors below");
              toast.error(typeof err === "string" ? err : "Invalid form data");
            }
          }}
          className="mt-4 grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              name="number"
              placeholder="PO-001"
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
            <input type="date" name="orderDate" className="w-full rounded-xl border px-3 py-2 text-sm" />
            <input type="date" name="expectedDate" className="w-full rounded-xl border px-3 py-2 text-sm" />
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
              <Button
                type="button"
                variant="utility"
                size="xs"
                onClick={() => setLines((prev) => [...prev, { description: "", qty: 1, unitPrice: 0 }])}
              >
                Add line
              </Button>
            </div>
          </div>
          <textarea
            name="notes"
            placeholder="Notes (optional)"
            className="w-full rounded-xl border px-3 py-2 text-sm min-h-[60px]"
          />
          <input type="hidden" name="linesJson" value={linesJson} />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end">
            <SubmitButton label="Create order" />
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function POStatusSelect({
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
        if (!PO_STATUSES.includes(status as (typeof PO_STATUSES)[number])) return;
        startTransition(async () => {
          const formData = new FormData();
          formData.set("status", status);
          const res = await updatePurchaseOrderStatus(id, formData);
          if (res.ok) {
            toast.success("Status updated");
            router.refresh();
          } else {
            toast.error(typeof res.error === "string" ? res.error : "Failed to update");
          }
        });
      }}
    >
      {PO_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function POTableHead({
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
      <th scope="col" className="px-4 py-3">Convert</th>
      <th scope="col" className="w-[120px] px-4 py-3">Action</th>
    </tr>
  );
}

export function DeletePOButton({
  id,
  status,
  label,
}: {
  id: string;
  status: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const canDelete = status === "DRAFT" || status === "CANCELLED";

  const handleDelete = async () => {
    setPending(true);
    const res = await deletePurchaseOrder(id);
    setPending(false);
    if (res.ok) {
      toast.success("Order deleted");
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to delete");
    }
  };

  return (
    <>
      <Button
        onClick={() => canDelete && setOpen(true)}
        disabled={pending || !canDelete}
        variant="utility"
        size="xs"
        title={!canDelete ? "Only DRAFT or CANCELLED can be deleted" : undefined}
      >
        {pending ? "..." : "Delete"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete purchase order?"
        description={`Are you sure you want to delete ${label}? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        pending={pending}
      />
    </>
  );
}

export function ConvertToBillButton({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [billNumber, setBillNumber] = useState("");
  const canConvert = status === "RECEIVED" || status === "PARTIALLY_RECEIVED";

  return (
    <div className="flex items-center gap-2">
      {canConvert && (
        <input
          type="text"
          placeholder="BILL-001"
          value={billNumber}
          onChange={(e) => setBillNumber(e.target.value)}
          className="rounded-lg border px-2 py-1 text-xs w-24"
        />
      )}
      <Button
        type="button"
        disabled={pending || !canConvert || (canConvert && !billNumber.trim())}
        variant="utility"
        size="xs"
        onClick={() => {
          if (!billNumber.trim()) return;
          start(async () => {
            const res = await convertPurchaseOrderToBill(orderId, billNumber.trim());
            if (res.ok) {
              toast.success("Bill created from order");
              router.refresh();
            } else {
              toast.error(typeof res.error === "string" ? res.error : "Failed to convert");
            }
          });
        }}
      >
        Convert to bill
      </Button>
    </div>
  );
}
