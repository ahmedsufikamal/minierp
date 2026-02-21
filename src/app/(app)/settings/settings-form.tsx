"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSettings } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Defaults = {
  orgName: string;
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

      <div className="rounded-2xl border p-4 space-y-2">
        <h3 className="font-medium">Number sequences</h3>
        <p className="text-sm text-muted-foreground">
          Number sequence management has moved to Company Numbering under organization settings.
        </p>
        <Link href="/org/settings/company-numbering" className="text-sm font-medium text-primary hover:underline">
          Open Company Numbering →
        </Link>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
