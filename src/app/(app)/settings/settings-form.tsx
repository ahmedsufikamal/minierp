"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Defaults = {
  orgName: string;
  invoicePrefix: string;
  invoiceNext: string;
  billPrefix: string;
  billNext: string;
  quotePrefix: string;
  quoteNext: string;
  poPrefix: string;
  poNext: string;
  defaultCurrency: string;
  taxRate: string;
};

export function SettingsForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <form
      className="max-w-2xl space-y-6"
      action={async (formData: FormData) => {
        setPending(true);
        const res = await saveSettings(formData);
        setPending(false);
        if (res.ok) {
          toast.success("Settings saved");
          router.refresh();
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Failed to save");
        }
      }}
    >
      <div className="rounded-2xl border p-4 space-y-4">
        <h3 className="font-medium">Organization</h3>
        <div>
          <Label htmlFor="orgName">Organization name</Label>
          <Input
            id="orgName"
            name="orgName"
            defaultValue={defaults.orgName}
            className="mt-1 max-w-xs"
          />
        </div>
        <div>
          <Label htmlFor="defaultCurrency">Default currency</Label>
          <Input
            id="defaultCurrency"
            name="defaultCurrency"
            defaultValue={defaults.defaultCurrency}
            placeholder="BDT"
            className="mt-1 max-w-xs"
          />
        </div>
        <div>
          <Label htmlFor="taxRate">Default tax rate % (optional)</Label>
          <Input
            id="taxRate"
            name="taxRate"
            type="number"
            step="0.01"
            defaultValue={defaults.taxRate}
            placeholder="0"
            className="mt-1 max-w-xs"
          />
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-4">
        <h3 className="font-medium">Number sequences</h3>
        <p className="text-sm text-muted-foreground">
          Prefix and next number for new documents. Next is incremented when you use it (manual for now).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Invoices</Label>
            <div className="flex gap-2 mt-1">
              <Input name="invoicePrefix" defaultValue={defaults.invoicePrefix} placeholder="INV-" />
              <Input name="invoiceNext" defaultValue={defaults.invoiceNext} placeholder="1" />
            </div>
          </div>
          <div>
            <Label>Bills</Label>
            <div className="flex gap-2 mt-1">
              <Input name="billPrefix" defaultValue={defaults.billPrefix} placeholder="BILL-" />
              <Input name="billNext" defaultValue={defaults.billNext} placeholder="1" />
            </div>
          </div>
          <div>
            <Label>Quotes</Label>
            <div className="flex gap-2 mt-1">
              <Input name="quotePrefix" defaultValue={defaults.quotePrefix} placeholder="QUOTE-" />
              <Input name="quoteNext" defaultValue={defaults.quoteNext} placeholder="1" />
            </div>
          </div>
          <div>
            <Label>Purchase orders</Label>
            <div className="flex gap-2 mt-1">
              <Input name="poPrefix" defaultValue={defaults.poPrefix} placeholder="PO-" />
              <Input name="poNext" defaultValue={defaults.poNext} placeholder="1" />
            </div>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
