import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { AddProductCard, DeleteRowButton } from "./components";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const orgId = await getOrgIdOrUserId();

  const products = await prisma.product.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle="Catalog items used in invoices, bills, and inventory."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AddProductCard />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Product list</div>
            <div className="text-sm text-slate-600">Total: {products.length}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Price</th>
                  <th className="w-[90px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.unit}</td>
                    <td className="px-4 py-3">{formatMoney(p.priceCents, "BDT")}</td>
                    <td className="px-4 py-3">
                      <DeleteRowButton id={p.id} />
                    </td>
                  </tr>
                ))}
                {products.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-slate-600" colSpan={5}>
                      No products yet. Create your first product on the left.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
