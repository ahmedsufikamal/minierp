"use client";

import { SalesInvoice, Customer } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

type CustomerWithInvoices = Customer & {
  invoices: SalesInvoice[];
};

export function InvoicesTab({ customer }: { customer: CustomerWithInvoices }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Invoices</h3>
      </div>

      <div className="grid gap-3">
        {customer.invoices.map((invoice) => (
          <Link key={invoice.id} href={`/invoices/${invoice.id}`}>
            <Card className="hover:border-indigo-300 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Invoice #{invoice.number}</div>
                    <div className="text-xs text-slate-500">
                      {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge variant={invoice.status === "PAID" ? "default" : "secondary"}>
                    {invoice.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {customer.invoices.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed">
            No invoices found for this customer.
          </div>
        )}
      </div>
    </div>
  );
}
