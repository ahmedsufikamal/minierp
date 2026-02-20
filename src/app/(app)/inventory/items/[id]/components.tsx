"use client";

import { formatMoney } from "@/lib/utils";
import { format } from "date-fns";
import type { Product, Brand, Category, SubCategory, StockBalance, StockLocation, StockLedger } from "@prisma/client";

type ProductWithRelations = Product & {
  brand: Brand;
  category: Category | null;
  subCategory: SubCategory | null;
  balances: (StockBalance & { location: StockLocation | null })[];
};

type LedgerEntry = StockLedger & {
  location: StockLocation | null;
};

export function ItemDetails({
  item,
  overallBalance,
  locationBalances,
}: {
  item: ProductWithRelations;
  overallBalance?: StockBalance & { location: StockLocation | null };
  locationBalances: (StockBalance & { location: StockLocation | null })[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5">
        <div className="font-medium mb-4">Item Information</div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">SKU</div>
            <div className="font-mono text-xs font-medium">{item.sku}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Brand</div>
            <div className="font-medium">{item.brand.name}</div>
          </div>
          {item.category && (
            <div>
              <div className="text-muted-foreground">Category</div>
              <div className="font-medium">
                {item.category.name}
                {item.subCategory && ` / ${item.subCategory.name}`}
              </div>
            </div>
          )}
          {item.description && (
            <div>
              <div className="text-muted-foreground">Description</div>
              <div>{item.description}</div>
            </div>
          )}
          {item.ratingType && (
            <div>
              <div className="text-muted-foreground">Rating/Type</div>
              <div>{item.ratingType}</div>
            </div>
          )}
          {item.coo && (
            <div>
              <div className="text-muted-foreground">Country of Origin</div>
              <div>{item.coo}</div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground">UOM</div>
            <div>{item.uom}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Unit Cost</div>
            <div className="font-medium">
              {formatMoney(item.unitCostMinor ?? item.priceCents, "BDT")}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-5">
        <div className="font-medium mb-4">Stock Levels</div>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-[hsl(var(--surface-elevated))] rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Overall</div>
              <div className="font-medium text-lg">
                {overallBalance?.qtyOnHand.toLocaleString() || 0} {item.uom}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Value</div>
              <div className="font-medium">
                {formatMoney(
                  (overallBalance?.qtyOnHand || 0) *
                    (overallBalance?.avgCostMinor ?? item.unitCostMinor ?? item.priceCents),
                  "BDT"
                )}
              </div>
            </div>
          </div>

          {locationBalances.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">By Location</div>
              {locationBalances.map((balance) => (
                <div
                  key={`${balance.itemId}-${balance.locationId ?? "overall"}`}
                  className="flex justify-between items-center p-2 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{balance.location?.code || "Unknown"}</div>
                    {balance.location?.name && (
                      <div className="text-xs text-muted-foreground">{balance.location.name}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {balance.qtyOnHand.toLocaleString()} {item.uom}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatMoney(balance.qtyOnHand * (balance.avgCostMinor ?? 0), "BDT")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ItemLedger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-muted-foreground bg-[hsl(var(--surface-elevated))]">
          <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
            <th>Date</th>
            <th>Type</th>
            <th>Location</th>
            <th>Qty Delta</th>
            <th>Unit Cost</th>
            <th>Total Cost</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b last:border-0">
              <td className="px-4 py-3 whitespace-nowrap">
                {format(new Date(entry.txnDate), "MMM d, yyyy")}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-[hsl(var(--surface-interactive))] text-foreground">
                  {entry.txnType}
                </span>
              </td>
              <td className="px-4 py-3">
                {entry.location ? (
                  <span className="font-mono text-xs">{entry.location.code}</span>
                ) : (
                  <span className="text-muted-foreground">Overall</span>
                )}
              </td>
              <td className="px-4 py-3 font-medium">
                {entry.qtyDelta > 0 ? "+" : ""}
                {entry.qtyDelta.toLocaleString()}
              </td>
              <td className="px-4 py-3">
                {formatMoney(entry.unitCostMinor ?? 0, "BDT")}
              </td>
              <td className="px-4 py-3 font-medium">
                {formatMoney(entry.totalCostMinor ?? 0, "BDT")}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                {entry.refInvoice || entry.refChalan || entry.notes || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
