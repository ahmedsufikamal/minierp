import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { getStockByProduct } from "@/lib/inventory";
import { DeleteRowButton, NewMoveCard } from "./components";
import { Button } from "@/components/ui/button";
import { Upload, Package, MapPin, Tag, Layers, History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const companyId = await getCompanyIdOrUserId();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'run1',hypothesisId:'A',location:'src/app/(app)/inventory/page.tsx:entry',message:'InventoryPage entry',data:{companyId,hasInventoryMove:!!prisma.inventoryMove},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const [moves, products, stockMap] = await Promise.all([
    // #region agent log
    (async () => {
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'run1',hypothesisId:'B',location:'src/app/(app)/inventory/page.tsx:beforeMovesQuery',message:'inventoryMove.findMany about to execute',data:{where:{companyId}},timestamp:Date.now()})}).catch(()=>{});
      try {
        return await prisma.inventoryMove.findMany({
          where: { companyId },
          include: { product: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
      } catch (error: any) {
        if (error?.message?.includes("Unknown argument `companyId`")) {
          return await prisma.inventoryMove.findMany({
            where: { orgId: companyId },
            include: { product: true },
            orderBy: { createdAt: "desc" },
            take: 200,
          });
        }
        throw error;
      }
    })(),
    // #endregion
    (async () => {
      try {
        const result = await prisma.product.findMany({
          where: { companyId },
          select: { id: true, sku: true, name: true, uom: true, lowStockThreshold: true },
          orderBy: { name: "asc" },
        });
        return result;
      } catch (error: any) {
        // Handle stale Prisma client (companyId not recognized)
        if (error?.message?.includes("Unknown argument `companyId`")) {
          try {
            const result = await prisma.product.findMany({
              where: { orgId: companyId },
              select: { id: true, sku: true, name: true, uom: true, lowStockThreshold: true },
              orderBy: { name: "asc" },
            });
            return result;
          } catch (fallbackError: any) {
            // If uom column doesn't exist, fallback to unit and map it
            if (fallbackError?.code === "P2022" || fallbackError?.message?.includes("does not exist")) {
              const result = await prisma.product.findMany({
                where: { orgId: companyId },
                select: { id: true, sku: true, name: true, unit: true, lowStockThreshold: true },
                orderBy: { name: "asc" },
              });
              // Map unit to uom for consistency
              return result.map((p: any) => ({ ...p, uom: p.unit || "pcs" }));
            }
            throw fallbackError;
          }
        }
        // Handle missing column (migration not applied)
        if (error?.code === "P2022" || error?.message?.includes("does not exist")) {
          // Try with unit instead of uom
          try {
            const result = await prisma.product.findMany({
              where: { companyId },
              select: { id: true, sku: true, name: true, unit: true, lowStockThreshold: true },
              orderBy: { name: "asc" },
            });
            // Map unit to uom for consistency
            return result.map((p: any) => ({ ...p, uom: p.unit || "pcs" }));
          } catch (unitError: any) {
            // If companyId also fails, try orgId with unit
            if (unitError?.message?.includes("Unknown argument `companyId`")) {
              const result = await prisma.product.findMany({
                where: { orgId: companyId },
                select: { id: true, sku: true, name: true, unit: true, lowStockThreshold: true },
                orderBy: { name: "asc" },
              });
              // Map unit to uom for consistency
              return result.map((p: any) => ({ ...p, uom: p.unit || "pcs" }));
            }
            throw unitError;
          }
        }
        throw error;
      }
    })(),
    getStockByProduct(companyId),
  ]);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'run1',hypothesisId:'C',location:'src/app/(app)/inventory/page.tsx:afterQueries',message:'InventoryPage queries resolved',data:{movesCount:moves.length,productsCount:products.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/brands">
              <Tag className="h-4 w-4 mr-2" />
              Brands
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/categories">
              <Layers className="h-4 w-4 mr-2" />
              Categories
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/snapshots">
              <History className="h-4 w-4 mr-2" />
              Snapshots
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
