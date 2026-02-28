"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createAccount, createJournalEntry, deleteAccount, deleteJournalEntry } from "./actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

type Account = { id: string; code: string; name: string; type: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function NewAccountCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Add account</div>
          <div className="text-sm text-muted-foreground">Extend chart of accounts.</div>
        </div>
        <Button
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
              className="w-full rounded-xl border px-3 py-2 text-sm bg-card"
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
          <div className="text-sm text-muted-foreground">Simple debit/credit entry.</div>
        </div>
        <Button
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
              className="w-full rounded-xl border px-3 py-2 text-sm bg-card"
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
              className="w-full rounded-xl border px-3 py-2 text-sm bg-card"
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

export function DeleteAccountButton({
  id,
  disabled = false,
  disabledReason,
}: {
  id: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button
        onClick={() =>
          start(() => {
            void (async () => {
              setError(null);
              const result = await deleteAccount(id);
              if (!result.ok) {
                setError(result.error ?? "Unable to delete account.");
              }
            })();
          })
        }
        disabled={pending || disabled}
        title={disabledReason}
        variant="utility"
        size="xs"
      >
        {pending ? "..." : "Delete"}
      </Button>
      {error ? <div className="text-[11px] text-amber-700">{error}</div> : null}
    </div>
  );
}

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      onClick={() =>
        start(() => {
          void deleteJournalEntry(id);
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
