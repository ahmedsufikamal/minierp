"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProduct } from "./actions";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

function fieldError(err: Record<string, string[]> | undefined, name: string): string | undefined {
  return err?.[name]?.[0];
}

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  priceCents: number;
  brandId: string;
};

type Props = {
  product: ProductRow | null;
  brands: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditProductDialog({ product, brands, open, onOpenChange }: Props) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setErrors({});
    if (!product) return;
    const res = await updateProduct(product.id, formData);
    if (res.ok) {
      toast.success("Product updated");
      onOpenChange(false);
      router.refresh();
    } else {
      const err = res.error;
      if (typeof err === "object") setErrors(err);
      toast.error(typeof err === "string" ? err : "Please fix the errors below");
    }
  }

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Update product details.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-product-brand" className="text-right">
              Brand
            </Label>
            <div className="col-span-3 space-y-1">
              <select
                id="edit-product-brand"
                name="brandId"
                defaultValue={product.brandId || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select Brand (defaults to SIEMENS)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-product-sku" className="text-right">
              SKU
            </Label>
            <div className="col-span-3 space-y-1">
              <Input
                id="edit-product-sku"
                name="sku"
                defaultValue={product.sku}
                className={fieldError(errors, "sku") ? "border-red-500" : ""}
                required
              />
              {fieldError(errors, "sku") && (
                <p className="text-xs text-red-600">{fieldError(errors, "sku")}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-product-name" className="text-right">
              Name
            </Label>
            <div className="col-span-3 space-y-1">
              <Input
                id="edit-product-name"
                name="name"
                defaultValue={product.name}
                className={fieldError(errors, "name") ? "border-red-500" : ""}
                required
              />
              {fieldError(errors, "name") && (
                <p className="text-xs text-red-600">{fieldError(errors, "name")}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-product-uom" className="text-right">
              UOM
            </Label>
            <Input
              id="edit-product-uom"
              name="uom"
              defaultValue={product.uom}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-product-price" className="text-right">
              Price
            </Label>
            <Input
              id="edit-product-price"
              name="price"
              type="number"
              step="0.01"
              defaultValue={(product.priceCents / 100).toFixed(2)}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="default">
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
