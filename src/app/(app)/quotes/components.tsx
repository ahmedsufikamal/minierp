"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createQuote, deleteQuote, updateQuoteStatus, convertQuoteToInvoice } from "./actions";
import { formatMoney } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SortableTh } from "@/components/ui/sortable-th";

type Customer = { id: string; name: string };
type Product = { id: string; sku: string; name: string; uom: string; priceCents: number };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
    </button>
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

const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export function NewQuoteCard({ customers, products }: { customers: Customer[]; products: Product[] }) {
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
          <div className="font-medium">Create quote</div>
          <div className="text-sm text-slate-600">Customer and line items.</div>
        </div>
        <button
          id="add-quote"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          {open ? "Close" : "New"}
        </button>
      </div>

      {open ? (
        <form
          action={async (formData: FormData) => {
            setFormError(null);
            const res = await createQuote(formData);
            if (res.ok) {
              toast.success("Quote created");
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
              placeholder="QUOTE-001"
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
            <input type="date" name="quoteDate" className="w-full rounded-xl border px-3 py-2 text-sm" />
            <input type="date" name="validUntil" className="w-full rounded-xl border px-3 py-2 text-sm" />
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
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50"
                onClick={() => setLines((prev) => [...prev, { description: "", qty: 1, unitPrice: 0 }])}
              >
                Add line
              </button>
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
            <SubmitButton label="Create quote" />
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function QuoteStatusSelect({
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
        if (!QUOTE_STATUSES.includes(status as (typeof QUOTE_STATUSES)[number])) return;
        startTransition(async () => {
          const formData = new FormData();
          formData.set("status", status);
          const res = await updateQuoteStatus(id, formData);
          if (res.ok) {
            toast.success("Status updated");
            router.refresh();
          } else {
            toast.error(typeof res.error === "string" ? res.error : "Failed to update");
          }
        });
      }}
    >
      {QUOTE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function QuoteTableHead({
  sort,
  order,
}: {
  sort?: string;
  order?: "asc" | "desc";
}) {
  return (
    <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
      <SortableTh sortKey="number" label="Number" currentSort={sort} currentOrder={order} />
      <th scope="col" className="px-4 py-3">Customer</th>
      <th scope="col" className="px-4 py-3">Status</th>
      <th scope="col" className="px-4 py-3">Total</th>
      <th scope="col" className="px-4 py-3">Convert</th>
      <th scope="col" className="w-[90px] px-4 py-3">Action</th>
    </tr>
  );
}

export function DeleteQuoteButton({
  id,
  canDelete,
  label,
}: {
  id: string;
  canDelete: boolean;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const handleDelete = async () => {
    setPending(true);
    const res = await deleteQuote(id);
    setPending(false);
    if (res.ok) {
      toast.success("Quote deleted");
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to delete");
    }
  };
  return (
    <>
      <button
        onClick={() => canDelete && setOpen(true)}
        disabled={pending || !canDelete}
        className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
        title={!canDelete ? "Cannot delete converted quote" : undefined}
      >
        {pending ? "..." : "Delete"}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete quote?"
        description={`Are you sure you want to delete quote ${label}? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        pending={pending}
      />
    </>
  );
}

export function ConvertToInvoiceButton({
  quoteId,
  converted,
  status,
}: {
  quoteId: string;
  converted: boolean;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [invNumber, setInvNumber] = useState("");

  const canConvert = !converted && (status === "DRAFT" || status === "ACCEPTED");

  return (
    <div className="flex items-center gap-2">
      {canConvert && (
        <input
          type="text"
          placeholder="INV-001"
          value={invNumber}
          onChange={(e) => setInvNumber(e.target.value)}
          className="rounded-lg border px-2 py-1 text-xs w-24"
        />
      )}
      <button
        type="button"
        disabled={pending || !canConvert || (canConvert && !invNumber.trim())}
        className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
        onClick={() => {
          if (!invNumber.trim()) return;
          start(async () => {
            const res = await convertQuoteToInvoice(quoteId, invNumber.trim());
            if (res.ok) {
              toast.success("Invoice created from quote");
              router.refresh();
            } else {
              toast.error(typeof res.error === "string" ? res.error : "Failed to convert");
            }
          });
        }}
      >
        {converted ? "Converted" : "Convert to invoice"}
      </button>
    </div>
  );
}
