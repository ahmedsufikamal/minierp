"use client";

import { Opportunity, Customer, OpportunityStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { createOpportunityAction } from "../actions";
import { useRef, useState } from "react";
import { KanbanBoard } from "@/components/crm/kanban-board";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

type CustomerWithDeals = Customer & {
  opportunities: Opportunity[];
};

export function DealsTab({ customer }: { customer: CustomerWithDeals }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function handleAddDeal(formData: FormData) {
    formData.append("customerId", customer.id);
    formData.append("stage", "NEW");
    
    try {
      await createOpportunityAction(formData);
      toast.success("Deal created successfully");
      formRef.current?.reset();
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to create deal");
    }
  }

  return (
    <div className="h-[calc(100vh-280px)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium tracking-tight">Deals Pipeline</h3>
          <p className="text-sm text-slate-500">
            Manage your opportunities with {customer.name}
          </p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" variant="dark">
              <Plus className="h-4 w-4" />
              New Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Deal</DialogTitle>
              <DialogDescription>
                Add a new opportunity to the pipeline for {customer.name}.
              </DialogDescription>
            </DialogHeader>
            <form action={handleAddDeal} className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Deal Title</Label>
                <Input id="title" name="title" placeholder="e.g. Q1 License Renewal" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="value">Value (Cents)</Label>
                <Input id="value" name="value" type="number" placeholder="10000" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Optional notes..." />
              </div>
              <DialogFooter>
                <Button type="submit" variant="dark">Create Deal</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden -mx-6 px-6 pb-2">
         {/* We pass all opportunities to the board, it will filter them into columns */}
        <KanbanBoard 
          initialOpportunities={customer.opportunities} 
          customerId={customer.id} 
        />
      </div>
    </div>
  );
}
