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
import { updateVendor } from "./actions";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Vendor } from "@prisma/client";

function fieldError(err: Record<string, string[]> | undefined, name: string): string | undefined {
  return err?.[name]?.[0];
}

type Props = {
  vendor: { id: string; name: string; email: string | null; phone: string | null; address: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditVendorDialog({ vendor, open, onOpenChange }: Props) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setErrors({});
    if (!vendor) return;
    const res = await updateVendor(vendor.id, formData);
    if (res.ok) {
      toast.success("Vendor updated");
      onOpenChange(false);
      router.refresh();
    } else {
      const err = res.error;
      if (typeof err === "object") setErrors(err);
      toast.error(typeof err === "string" ? err : "Please fix the errors below");
    }
  }

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Vendor</DialogTitle>
          <DialogDescription>Update vendor details.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-vendor-name" className="text-right">
              Name
            </Label>
            <div className="col-span-3 space-y-1">
              <Input
                id="edit-vendor-name"
                name="name"
                defaultValue={vendor.name}
                className={fieldError(errors, "name") ? "border-red-500" : ""}
                required
              />
              {fieldError(errors, "name") && (
                <p className="text-xs text-red-600">{fieldError(errors, "name")}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-vendor-email" className="text-right">
              Email
            </Label>
            <div className="col-span-3 space-y-1">
              <Input
                id="edit-vendor-email"
                name="email"
                defaultValue={vendor.email ?? ""}
                className={fieldError(errors, "email") ? "border-red-500" : ""}
              />
              {fieldError(errors, "email") && (
                <p className="text-xs text-red-600">{fieldError(errors, "email")}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-vendor-phone" className="text-right">
              Phone
            </Label>
            <Input
              id="edit-vendor-phone"
              name="phone"
              defaultValue={vendor.phone ?? ""}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-vendor-address" className="text-right">
              Address
            </Label>
            <Input
              id="edit-vendor-address"
              name="address"
              defaultValue={vendor.address ?? ""}
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
