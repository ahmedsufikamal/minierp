import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { DeleteRowButton, NewMoveCard } from "./components";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const orgId = await getOrgIdOrUserId();

  const [moves, products] = await Promise.all([
    prisma.inventoryMove.findMany({
      where: { orgId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.product.findMany({
      where: { orgId },
      select: { id: true, sku: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Quick stock calculation
  const stock = new Map<string, number>();
  for (const m of moves.slice().reverse()) {
    const prev = stock.get(m.productId) ?? 0;
    const delta = m.type === "OUT" ? -m.qty : m.qty;
    stock.set(m.productId, prev + delta);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle="Track stock movement history." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NewMoveCard products={products} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border">
            <div className="p-4 border-b">
              <div className="font-medium">Stock snapshot (based on moves)</div>
              <div className="text-sm text-slate-600">
                Latest computed stock per product.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3">{p.name}</td>
                      <td className="px-4 py-3">{p.unit}</td>
                      <td className="px-4 py-3 font-medium">
                        {stock.get(p.id) ?? 0}
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-slate-600" colSpan={4}>
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
