"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import type { Product, Brand, Category, SubCategory, StockBalance, StockLocation } from "@prisma/client";

export function InventoryFilters({
  brands,
  categories,
  locations,
  brandFilter,
  categoryFilter,
  locationFilter,
}: {
  brands: Brand[];
  categories: Category[];
  locations: StockLocation[];
  brandFilter?: string;
  categoryFilter?: string;
  locationFilter?: string;
}) {
  const router = useRouter();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <>
      <select
        name="brand"
        value={brandFilter || ""}
        onChange={(e) => updateFilter("brand", e.target.value)}
        className="rounded-xl border px-3 py-2 text-sm"
      >
        <option value="">All Brands</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        name="category"
        value={categoryFilter || ""}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="rounded-xl border px-3 py-2 text-sm"
      >
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        name="location"
        value={locationFilter || ""}
        onChange={(e) => updateFilter("location", e.target.value)}
        className="rounded-xl border px-3 py-2 text-sm"
      >
        <option value="">All Locations</option>
        {locations.map((l) => (
          <option key={l.id} value={l.code}>
            {l.code} {l.name ? `(${l.name})` : ""}
          </option>
        ))}
      </select>
    </>
  );
}

type ProductWithRelations = Product & {
  brand: Brand;
  category: Category | null;
  subCategory: SubCategory | null;
  balances: (StockBalance & { location: StockLocation | null })[];
};

export function InventoryItemsList({
  items,
  stockMap,
  locationFilter,
}: {
  items: ProductWithRelations[];
  stockMap: Map<string, { overall: number; byLocation: Record<string, number> }>;
  locationFilter?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-muted-foreground bg-[hsl(var(--surface-elevated))]">
          <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
            <th>SKU</th>
            <th>Brand</th>
            <th>Name</th>
            <th>Category</th>
            <th>Stock (Overall)</th>
            {locationFilter && <th>Stock ({locationFilter})</th>}
            <th>Unit Cost</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const stock = stockMap.get(item.id) || { overall: 0, byLocation: {} };
            const locationStock = locationFilter ? stock.byLocation[locationFilter] || 0 : null;
            
            return (
              <tr key={item.id} className="border-b last:border-0 hover:bg-[hsl(var(--surface-elevated))]">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/inventory/items/${item.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {item.sku}
                  </Link>
                </td>
                <td className="px-4 py-3">{item.brand.name}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {item.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.category && (
                    <div>
                      {item.category.name}
                      {item.subCategory && (
                        <span className="text-muted-foreground"> / {item.subCategory.name}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {stock.overall.toLocaleString()} {item.uom}
                </td>
                {locationFilter && (
                  <td className="px-4 py-3 font-medium">
                    {locationStock?.toLocaleString() || 0} {item.uom}
                  </td>
                )}
                <td className="px-4 py-3">
                  {formatMoney(item.unitCostMinor ?? item.priceCents, "BDT")}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/inventory/items/${item.id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
