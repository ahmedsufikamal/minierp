"use client";

import { Customer } from "@prisma/client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { MoreHorizontal, Search, Mail, Phone, Trash2, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { deleteCustomer } from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { EditCustomerDialog } from "./edit-customer-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Placeholder for Table components since I haven't created them yet,
// I'll assume standard HTML table structure with Tailwind classes if I don't make the shadcn Table.
// Actually, for "Best CRM", I should make the shadcn Table component.
// I will just use standard HTML with high quality classes here to save tool calls
// or I can quickly create table.tsx.
// Let's stick to standard div/table structure for speed but high quality key.

export function CustomerTable({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const router = useRouter();

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: string, name: string) => {
    setDeletePending(true);
    const res = await deleteCustomer(id);
    setDeletePending(false);
    if (res.ok) {
      toast.success(`${name} deleted`);
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to delete customer");
    }
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search customers..."
            className="pl-9 bg-white"
            value={search}
            onChange={({ target }) => setSearch(target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50/50 border-b border-slate-200/60 text-slate-500 font-medium">
            <tr>
              <th className="px-4 py-3 pl-6">Customer</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3 hidden md:table-cell">Details</th>
              <th className="px-4 py-3 text-right pr-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((customer) => (
              <tr key={customer.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-slate-200/50">
                      <AvatarFallback className="bg-indigo-50 text-indigo-700 font-medium text-xs">
                        {customer.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors"
                      >
                        {customer.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        Added {format(new Date(customer.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="h-3 w-3" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="text-slate-600 text-xs max-w-[200px] truncate">
                    {customer.address || "No address provided"}
                  </div>
                </td>
                <td className="px-4 py-3 pr-6 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-900"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="flex items-center cursor-pointer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" /> View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(customer)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setDeleteTarget({ id: customer.id, name: customer.name })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EditCustomerDialog
        customer={editingCustomer}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingCustomer(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete customer?"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() =>
          deleteTarget ? handleDelete(deleteTarget.id, deleteTarget.name) : undefined
        }
        pending={deletePending}
      />
    </div>
  );
}
