"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { createCustomer } from "./actions";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

function fieldError(err: string | Record<string, string[]> | undefined, name: string): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  const arr = err[name];
  return Array.isArray(arr) ? arr[0] : undefined;
}

export function NewCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setErrors({});
    const res = await createCustomer(formData);
    if (res.ok) {
      toast.success("Customer created successfully");
      setOpen(false);
      router.refresh();
    } else {
      const err = res.error;
      if (typeof err === "object") setErrors(err);
      toast.error(typeof err === "string" ? err : "Please fix the errors below");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" variant="default">
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>
            Create a new customer profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <div className="col-span-3 space-y-1">
              <Input id="name" name="name" placeholder="Acme Inc." className={fieldError(errors, "name") ? "border-red-500" : ""} required />
              {fieldError(errors, "name") && <p className="text-xs text-red-600">{fieldError(errors, "name")}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <div className="col-span-3 space-y-1">
              <Input id="email" name="email" placeholder="contact@acme.com" className={fieldError(errors, "email") ? "border-red-500" : ""} />
              {fieldError(errors, "email") && <p className="text-xs text-red-600">{fieldError(errors, "email")}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Phone
            </Label>
            <Input id="phone" name="phone" placeholder="+1 (555) 000-0000" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">
              Address
            </Label>
            <Input
              id="address"
              name="address"
              placeholder="123 Main St..."
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
