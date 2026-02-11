"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createCustomer, deleteCustomer } from "./actions";
import { Button } from "@/components/ui/button";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function AddCustomerCard() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Add customer</div>
          <div className="text-sm text-slate-600">Create a new customer record.</div>
        </div>
        <Button
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
            await createCustomer(formData);
          }}
          className="mt-4 grid gap-3"
        >
          <input
            name="name"
            placeholder="Customer name"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <input
            name="email"
            placeholder="Email (optional)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <input
            name="phone"
            placeholder="Phone (optional)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <input
            name="address"
            placeholder="Address (optional)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <div className="flex justify-end">
            <SubmitButton label="Create" />
          </div>
        </form>
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
          void deleteCustomer(id);
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
