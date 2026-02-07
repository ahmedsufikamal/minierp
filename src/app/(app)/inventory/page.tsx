import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { getStockByProduct } from "@/lib/inventory";
import { DeleteRowButton, NewMoveCard } from "./components";
import { Button } from "@/components/ui/button";
import { Upload, Package, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const companyId = await getCompanyIdOrUserId();

  const [moves, products, stockMap] = await Promise.all([
    prisma.inventoryMove.findMany({
      where: { companyId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.product.findMany({
      where: { companyId },
      select: { id: true, sku: true, name: true, uom: true, lowStockThreshold: true },
      orderBy: { name: "asc" },
    }),
    getStockByProduct(companyId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Inventory" subtitle="Track stock movement history." />
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/import">
              <Upload className="h-4 w-4 mr-2" />
              Import Excel
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/items">
              <Package className="h-4 w-4 mr-2" />
              Items
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/locations">
              <MapPin className="h-4 w-4 mr-2" />
              Locations
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NewMoveCard products={products} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border">
            <div className="p-4 border-b">
              <div className="font-medium">Stock snapshot (based on moves)</div>
              <div className="text-sm text-slate-600">Latest computed stock per product.</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                    <th>SKU</th>
                    <th>Name</th>
                    <th>UOM</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const stock = stockMap.get(p.id) ?? 0;
                    const isLow =
                      p.lowStockThreshold != null && stock < p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                        <td className="px-4 py-3">{p.name}</td>
                        <td className="px-4 py-3">{p.uom}</td>
                        <td className="px-4 py-3 font-medium">{stock}</td>
                        <td className="px-4 py-3">
                          {isLow && (
                            <span className="text-amber-600 text-xs font-medium">
                              Low stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-slate-600" colSpan={5}>
                        No products yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border">
            <div className="p-4 border-b">
              <div className="font-medium">Move history</div>
              <div className="text-sm text-slate-600">Showing last {moves.length} moves</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                    <th>Time</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Note</th>
                    <th className="w-[90px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="px-4 py-3">{m.product.name}</td>
                      <td className="px-4 py-3">{m.type}</td>
                      <td className="px-4 py-3 font-medium">{m.qty}</td>
                      <td className="px-4 py-3">{m.note ?? "—"}</td>
                      <td className="px-4 py-3">
                        <DeleteRowButton id={m.id} />
                      </td>
                    </tr>
                  ))}
                  {moves.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-slate-600" colSpan={6}>
                        No moves yet. Create your first move on the left.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
