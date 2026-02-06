"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createVendor, deleteVendor } from "./actions";
import { EditVendorDialog } from "./edit-vendor-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Vendor } from "@prisma/client";

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

export function AddVendorCard() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Add vendor</div>
          <div className="text-sm text-slate-600">Create a new vendor record.</div>
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
            const res = await createVendor(formData);
            if (res.ok) {
              setOpen(false);
              router.refresh();
            }
          }}
          className="mt-4 grid gap-3"
        >
          <input
            name="name"
            placeholder="Vendor name"
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

export function DeleteRowButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const handleDelete = async () => {
    setPending(true);
    const res = await deleteVendor(id);
    setPending(false);
    if (res.ok) {
      toast.success("Vendor deleted");
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to delete");
    }
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "..." : "Delete"}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete vendor?"
        description={`Are you sure you want to delete "${label}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        pending={pending}
      />
    </>
  );
}

export function VendorList({ vendors }: { vendors: Vendor[] }) {
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-600">
            <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th className="w-[120px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{v.name}</td>
                <td className="px-4 py-3">{v.email ?? "—"}</td>
                <td className="px-4 py-3">{v.phone ?? "—"}</td>
                <td className="px-4 py-3 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVendor(v);
                      setEditOpen(true);
                    }}
                    className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <DeleteRowButton id={v.id} label={v.name} />
                </td>
              </tr>
            ))}
            {vendors.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-600" colSpan={4}>
                  No vendors yet. Create your first vendor on the left.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <EditVendorDialog
        vendor={editingVendor}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingVendor(null);
        }}
      />
    </>
  );
}
