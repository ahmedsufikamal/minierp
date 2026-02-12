"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProduct, deleteProduct } from "./actions";
import { EditProductDialog } from "./edit-product-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SortableTh } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import type { Product } from "@prisma/client";

export type ProductListRow = Product & {
  brand?: { name: string } | null;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function AddProductCard({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Add product</div>
          <div className="text-sm text-slate-600">SKU, UOM, and default selling price.</div>
        </div>
        <Button
          id="add-product"
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
            const res = await createProduct(formData);
            if (res.ok) {
              setOpen(false);
              router.refresh();
            }
          }}
          className="mt-4 grid gap-3"
        >
          <select
            name="brandId"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="">Select Brand (defaults to SIEMENS)</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
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
              name="uom"
              placeholder="UOM (pcs, kg)"
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
  sort,
  order,
  brands,
}: {
  products: ProductListRow[];
  stockByProductId?: Record<string, number>;
  sort?: string;
  order?: "asc" | "desc";
  brands: Array<{ id: string; name: string }>;
}) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full text-sm">
          <thead className="text-left text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <SortableTh sortKey="sku" label="SKU" currentSort={sort} currentOrder={order} />
                  <SortableTh sortKey="name" label="Name" currentSort={sort} currentOrder={order} />
                  <th scope="col" className="px-4 py-3">UOM</th>
                  <SortableTh sortKey="priceCents" label="Price" currentSort={sort} currentOrder={order} />
                  <th scope="col" className="px-4 py-3">Stock</th>
                  <th scope="col" className="w-[120px] px-4 py-3">Action</th>
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
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {"brand" in p && p.brand && (
                        <div className="text-xs text-slate-500">{p.brand.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{p.uom}</td>
                    <td className="px-4 py-3">{formatMoney(p.priceCents, "BDT")}</td>
                    <td className="px-4 py-3">
                      <span className={isLow ? "text-amber-600 font-medium" : ""}>
                        {stock}
                        {isLow && " (low)"}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-1">
                  <Button
                    type="button"
                    variant="utility"
                    size="xs"
                    onClick={() => {
                      setEditingProduct(p);
                      setEditOpen(true);
                    }}
                  >
                    Edit
                  </Button>
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
        brands={brands}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingProduct(null);
        }}
      />
    </>
  );
}
