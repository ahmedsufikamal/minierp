"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type SalesRow = { customerName: string; count: number; totalCents: number };
type PurchasesRow = { vendorName: string; count: number; totalCents: number };
type AgedRow = {
  number: string;
  customerName?: string;
  vendorName?: string;
  dueDate: Date | null;
  totalCents: number;
  paidCents: number;
  dueCents: number;
};

type Props = {
  defaultFrom: string;
  defaultTo: string;
  salesTotalCents: number;
  purchasesTotalCents: number;
  paymentsInCents: number;
  paymentsOutCents: number;
  profitCents: number;
  incomeCents: number;
  expenseCents: number;
  salesByCustomer: SalesRow[];
  purchasesByVendor: PurchasesRow[];
  agedReceivables: AgedRow[];
  agedPayables: AgedRow[];
};

export function ReportsClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(props.defaultFrom);
  const [to, setTo] = useState(props.defaultTo);

  function applyFilter() {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("from", from);
    params.set("to", to);
    router.push(`/reports?${params.toString()}`);
  }

  function setPreset(preset: "this-month" | "last-3" | "ytd") {
    const now = new Date();
    let fromDate: Date;
    if (preset === "this-month") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === "last-3") {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else {
      fromDate = new Date(now.getFullYear(), 0, 1);
    }
    const toDate = preset === "this-month" ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setFrom(fromDate.toISOString().slice(0, 10));
    setTo(toDate.toISOString().slice(0, 10));
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("from", fromDate.toISOString().slice(0, 10));
    params.set("to", toDate.toISOString().slice(0, 10));
    router.push(`/reports?${params.toString()}`);
  }

  const salesChartData = props.salesByCustomer.map((r) => ({
    name: r.customerName.length > 12 ? r.customerName.slice(0, 12) + "…" : r.customerName,
    totalCents: r.totalCents,
  }));
  const plChartData = [
    { name: "Income", value: props.incomeCents, fill: "hsl(var(--color-status-success))" },
    { name: "Expenses", value: props.expenseCents, fill: "hsl(var(--destructive))" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex flex-col gap-1">
          <Label htmlFor="reports-from">From</Label>
          <Input
            id="reports-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="reports-to">To</Label>
          <Input
            id="reports-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button type="button" onClick={applyFilter}>
          Apply
        </Button>
        <div className="flex gap-2 ml-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPreset("this-month")}>
            This month
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPreset("last-3")}>
            Last 3 months
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPreset("ytd")}>
            YTD
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="pl">P&amp;L</TabsTrigger>
          <TabsTrigger value="aged">Aged</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="rounded-2xl border p-4 mt-4">
          <h3 className="font-medium mb-2">Sales summary</h3>
          <p className="text-sm text-slate-600 mb-4">
            Total sales: {formatMoney(props.salesTotalCents)} | Payments received:{" "}
            {formatMoney(props.paymentsInCents)}
          </p>
          {salesChartData.length > 0 && (
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 100).toFixed(0)} />
                  <Tooltip formatter={(v: number) => [(v / 100).toFixed(2), "Total"]} />
                  <Bar dataKey="totalCents" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th scope="col" className="py-2">Customer</th>
                <th scope="col" className="py-2">Invoices</th>
                <th scope="col" className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {props.salesByCustomer.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{row.customerName}</td>
                  <td className="py-2">{row.count}</td>
                  <td className="py-2">{formatMoney(row.totalCents)}</td>
                </tr>
              ))}
              {props.salesByCustomer.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-slate-500 text-center">
                    No sales in period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="purchases" className="rounded-2xl border p-4 mt-4">
          <h3 className="font-medium mb-2">Purchases summary</h3>
          <p className="text-sm text-slate-600 mb-4">
            Total purchases: {formatMoney(props.purchasesTotalCents)} | Payments made:{" "}
            {formatMoney(props.paymentsOutCents)}
          </p>
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th scope="col" className="py-2">Vendor</th>
                <th scope="col" className="py-2">Bills</th>
                <th scope="col" className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {props.purchasesByVendor.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{row.vendorName}</td>
                  <td className="py-2">{row.count}</td>
                  <td className="py-2">{formatMoney(row.totalCents)}</td>
                </tr>
              ))}
              {props.purchasesByVendor.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-slate-500 text-center">
                    No purchases in period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="pl" className="rounded-2xl border p-4 mt-4">
          <h3 className="font-medium mb-2">Profit &amp; Loss (from journal)</h3>
          {plChartData.some((d) => d.value > 0) && (
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plChartData} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis type="number" tickFormatter={(v) => (v / 100).toFixed(0)} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [(v / 100).toFixed(2), ""]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="grid gap-2 max-w-sm">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Income</span>
              <span>{formatMoney(props.incomeCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Expenses</span>
              <span>{formatMoney(props.expenseCents)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-2">
              <span>Profit</span>
              <span>{formatMoney(props.profitCents)}</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="aged" className="rounded-2xl border p-4 mt-4 space-y-6">
          <div>
            <h3 className="font-medium mb-2">Aged receivables</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="py-2">Number</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2">Due date</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Paid</th>
                  <th className="py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {props.agedReceivables.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{row.number}</td>
                    <td className="py-2">{row.customerName}</td>
                    <td className="py-2">
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2">{formatMoney(row.totalCents)}</td>
                    <td className="py-2">{formatMoney(row.paidCents)}</td>
                    <td className="py-2 font-medium">{formatMoney(row.dueCents)}</td>
                  </tr>
                ))}
                {props.agedReceivables.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-slate-500 text-center">
                      No unpaid invoices
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="font-medium mb-2">Aged payables</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="py-2">Number</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2">Due date</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Paid</th>
                  <th className="py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {props.agedPayables.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{row.number}</td>
                    <td className="py-2">{row.vendorName}</td>
                    <td className="py-2">
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2">{formatMoney(row.totalCents)}</td>
                    <td className="py-2">{formatMoney(row.paidCents)}</td>
                    <td className="py-2 font-medium">{formatMoney(row.dueCents)}</td>
                  </tr>
                ))}
                {props.agedPayables.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-slate-500 text-center">
                      No unpaid bills
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
