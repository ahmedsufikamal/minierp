"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProduct, deleteProduct } from "./actions";
import { EditProductDialog } from "./edit-product-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatMoney } from "@/lib/utils";
import type { Product } from "@prisma/client";

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

export function AddProductCard() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Add product</div>
          <div className="text-sm text-slate-600">SKU, unit, and default selling price.</div>
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
            const res = await createProduct(formData);
            if (res.ok) {
              setOpen(false);
              router.refresh();
            }
          }}
          className="mt-4 grid gap-3"
        >
          <input
            name="sku"
            placeholder="SKU (e.g., P-001)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <input
            name="name"
            placeholder="Product name"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="unit"
              placeholder="Unit (pcs, kg)"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
            <input
              name="price"
              placeholder="Default price"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
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
    const res = await deleteProduct(id);
    setPending(false);
    if (res.ok) {
      toast.success("Product deleted");
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
        title="Delete product?"
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

export function ProductList({
  products,
  stockByProductId = {},
}: {
  products: Product[];
  stockByProductId?: Record<string, number>;
}) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th className="w-[120px]">Action</th>
                </tr>
          </thead>
          <tbody>
                {products.map((p) => {
                  const stock = stockByProductId[p.id] ?? 0;
                  const isLow =
                    p.lowStockThreshold != null && stock < p.lowStockThreshold;
                  return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.unit}</td>
                    <td className="px-4 py-3">{formatMoney(p.priceCents, "BDT")}</td>
                    <td className="px-4 py-3">
                      <span className={isLow ? "text-amber-600 font-medium" : ""}>
                        {stock}
                        {isLow && " (low)"}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(p);
                      setEditOpen(true);
                    }}
                    className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <DeleteRowButton id={p.id} label={p.name} />
                </td>
              </tr>
                  );
            })}
            {products.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-600" colSpan={6}>
                  No products yet. Create your first product on the left.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <EditProductDialog
        product={editingProduct}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingProduct(null);
        }}
      />
    </>
  );
}
