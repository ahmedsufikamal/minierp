"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import type { StockLocation } from "@prisma/client";

export function LocationsList({
  locations,
  locationTotals,
}: {
  locations: StockLocation[];
  locationTotals: Map<string, { qty: number; value: number; itemCount: number }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-slate-600 bg-slate-50">
          <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
            <th>Code</th>
            <th>Name</th>
            <th>Items</th>
            <th>Total Qty</th>
            <th>Total Value</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => {
            const totals = locationTotals.get(location.code) || {
              qty: 0,
              value: 0,
              itemCount: 0,
            };

            return (
              <tr key={location.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-medium">
                  {location.code}
                </td>
                <td className="px-4 py-3">{location.name || "—"}</td>
                <td className="px-4 py-3">{totals.itemCount}</td>
                <td className="px-4 py-3 font-medium">
                  {totals.qty.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatMoney(totals.value, "BDT")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
