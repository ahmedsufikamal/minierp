"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createAccount, createJournalEntry, deleteAccount, deleteJournalEntry } from "./actions";
import { formatMoney } from "@/lib/utils";

type Account = { id: string; code: string; name: string; type: string };

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

export function NewAccountCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Add account</div>
          <div className="text-sm text-slate-600">Extend chart of accounts.</div>
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
            await createAccount(formData);
          }}
          className="mt-4 grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              name="code"
              placeholder="Code (e.g., 5200)"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
            <select
              name="type"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              defaultValue="EXPENSE"
            >
              <option value="ASSET">ASSET</option>
              <option value="LIABILITY">LIABILITY</option>
              <option value="EQUITY">EQUITY</option>
              <option value="INCOME">INCOME</option>
              <option value="EXPENSE">EXPENSE</option>
            </select>
          </div>
          <input
            name="name"
            placeholder="Account name"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <div className="flex justify-end">
            <SubmitButton label="Create account" />
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function NewJournalEntryCard({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const defaultDebit = useMemo(
    () => accounts.find((a) => a.type === "EXPENSE")?.id ?? "",
    [accounts],
  );
  const defaultCredit = useMemo(
    () => accounts.find((a) => a.type === "ASSET")?.id ?? "",
    [accounts],
  );

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">New journal entry</div>
          <div className="text-sm text-slate-600">Simple debit/credit entry.</div>
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
            await createJournalEntry(formData);
          }}
          className="mt-4 grid gap-3"
        >
          <input type="date" name="date" className="w-full rounded-xl border px-3 py-2 text-sm" />
          <input
            name="memo"
            placeholder="Memo (optional)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              name="debitAccountId"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              defaultValue={defaultDebit}
              required
            >
              <option value="" disabled>
                Debit account
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
            <select
              name="creditAccountId"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              defaultValue={defaultCredit}
              required
            >
              <option value="" disabled>
                Credit account
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <input
            name="amount"
            placeholder="Amount (e.g., 1250.00)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <div className="flex justify-end">
            <SubmitButton label="Post entry" />
          </div>
          {accounts.length < 2 ? (
            <p className="text-xs text-amber-700">
              Add accounts (or click “Init chart of accounts” on Dashboard) first.
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function DeleteAccountButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(() => {
          void deleteAccount(id);
        })
      }
      disabled={pending}
      className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "..." : "Delete"}
    </button>
  );
}

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(() => {
          void deleteJournalEntry(id);
        })
      }
      disabled={pending}
      className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "..." : "Delete"}
    </button>
  );
}

export function AmountCell({
  debitCents,
  creditCents,
}: {
  debitCents: number;
  creditCents: number;
}) {
  const val = debitCents > 0 ? debitCents : -creditCents;
  const label = debitCents > 0 ? "Dr" : "Cr";
  return (
    <span className="font-medium">
      {label} {formatMoney(Math.abs(val), "BDT")}
    </span>
  );
}
