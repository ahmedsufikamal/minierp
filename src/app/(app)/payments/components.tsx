"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createPayment } from "./actions";
import { toast } from "sonner";

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

type Invoice = { id: string; number: string };
type Bill = { id: string; number: string };

export function NewPaymentCard({
  invoices,
  bills,
}: {
  invoices: Invoice[];
  bills: Bill[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<"invoice" | "bill">("invoice");

  return (
    <div id="add-payment" className="rounded-2xl border p-5">
      <div className="font-medium">Record payment</div>
      <div className="text-sm text-slate-600 mb-4">Link to an unpaid invoice or bill.</div>

      <form
        action={async (formData: FormData) => {
          setFormError(null);
          if (linkType === "invoice") {
            formData.set("invoiceId", formData.get("invoiceId") as string);
            formData.set("billId", "");
          } else {
            formData.set("billId", formData.get("billId") as string);
            formData.set("invoiceId", "");
          }
          formData.set("type", linkType === "invoice" ? "INBOUND" : "OUTBOUND");
          const res = await createPayment(formData);
          if (res.ok) {
            toast.success("Payment recorded");
            router.refresh();
          } else {
            const err = res.error;
            setFormError(typeof err === "string" ? err : Object.values(err).flat().join(", "));
            toast.error(typeof err === "string" ? err : "Invalid form data");
          }
        }}
        className="grid gap-3"
      >
        <div>
          <label className="text-xs text-slate-600">Link to</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="linkType"
                checked={linkType === "invoice"}
                onChange={() => setLinkType("invoice")}
              />
              Invoice
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="linkType"
                checked={linkType === "bill"}
                onChange={() => setLinkType("bill")}
              />
              Bill
            </label>
          </div>
        </div>

        {linkType === "invoice" ? (
          <div>
            <label className="text-xs text-slate-600">Invoice</label>
            <select
              name="invoiceId"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white mt-1"
              required={linkType === "invoice"}
            >
              <option value="">Select invoice</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number}
                </option>
              ))}
              {invoices.length === 0 && (
                <option value="" disabled>
                  No unpaid invoices
                </option>
              )}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs text-slate-600">Bill</label>
            <select
              name="billId"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white mt-1"
              required={linkType === "bill"}
            >
              <option value="">Select bill</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.number}
                </option>
              ))}
              {bills.length === 0 && (
                <option value="" disabled>
                  No unpaid bills
                </option>
              )}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-600">Amount (e.g. 100.50)</label>
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0.01"
            placeholder="100.00"
            className="w-full rounded-xl border px-3 py-2 text-sm mt-1"
            required
          />
        </div>

        <div>
          <label className="text-xs text-slate-600">Date</label>
          <input
            type="date"
            name="date"
            className="w-full rounded-xl border px-3 py-2 text-sm mt-1"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div>
          <label className="text-xs text-slate-600">Method</label>
          <select
            name="method"
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white mt-1"
          >
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-600">Reference (optional)</label>
          <input
            name="reference"
            placeholder="Check #, ref..."
            className="w-full rounded-xl border px-3 py-2 text-sm mt-1"
          />
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end">
          <SubmitButton label="Record payment" />
        </div>
      </form>

      <p className="text-xs text-slate-500 mt-3">
        Enter amount in currency units (e.g. 100.50).
      </p>
    </div>
  );
}
