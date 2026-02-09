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
import { updateCustomer } from "./actions";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Customer } from "@prisma/client";

function fieldError(err: Record<string, string[]> | undefined, name: string): string | undefined {
  return err?.[name]?.[0];
}

type Props = {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditCustomerDialog({ customer, open, onOpenChange }: Props) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setErrors({});
    if (!customer) return;
    const res = await updateCustomer(customer.id, formData);
    if (res.ok) {
      toast.success("Customer updated");
      onOpenChange(false);
      router.refresh();
    } else {
      const err = res.error;
      if (typeof err === "object") setErrors(err);
      toast.error(typeof err === "string" ? err : "Please fix the errors below");
    }
  }

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>Update customer details.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-name" className="text-right">
              Name
            </Label>
            <div className="col-span-3 space-y-1">
              <Input
                id="edit-name"
                name="name"
                defaultValue={customer.name}
                className={fieldError(errors, "name") ? "border-red-500" : ""}
                required
              />
              {fieldError(errors, "name") && (
                <p className="text-xs text-red-600">{fieldError(errors, "name")}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-email" className="text-right">
              Email
            </Label>
            <div className="col-span-3 space-y-1">
              <Input
                id="edit-email"
                name="email"
                defaultValue={customer.email ?? ""}
                className={fieldError(errors, "email") ? "border-red-500" : ""}
              />
              {fieldError(errors, "email") && (
                <p className="text-xs text-red-600">{fieldError(errors, "email")}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-phone" className="text-right">
              Phone
            </Label>
            <Input
              id="edit-phone"
              name="phone"
              defaultValue={customer.phone ?? ""}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-address" className="text-right">
              Address
            </Label>
            <Input
              id="edit-address"
              name="address"
              defaultValue={customer.address ?? ""}
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
