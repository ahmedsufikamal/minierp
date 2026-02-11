"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FilterRailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerSegment: string;
  onCustomerSegmentChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
}

export function FilterRail({ open, onOpenChange, customerSegment, onCustomerSegmentChange, status, onStatusChange }: FilterRailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>More filters</DialogTitle>
        <div className="grid gap-4 pt-2">
          <label className="grid gap-1 text-sm">
            Customer segment
            <select className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-1))] px-2" value={customerSegment} onChange={(e) => onCustomerSegmentChange(e.target.value)}>
              <option value="">Any</option>
              <option value="enterprise">Enterprise</option>
              <option value="smb">SMB</option>
              <option value="retail">Retail</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Status
            <select className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-1))] px-2" value={status} onChange={(e) => onStatusChange(e.target.value)}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <div className="flex justify-end">
            <Button type="button" onClick={() => onOpenChange(false)}>Apply filters</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
