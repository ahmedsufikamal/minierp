import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { getStockByProduct } from "@/lib/inventory";
import { AddProductCard, ProductList } from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { getPaginationParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductsPage(props: PageProps) {
  const orgId = await getOrgIdOrUserId();
  const searchParams = (await props.searchParams?.()) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });

  const [products, total, stockMap] = await Promise.all([
    prisma.product.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.product.count({ where: { orgId } }),
    getStockByProduct(orgId),
  ]);

  const totalPages = getTotalPages(total, limit);
  const stockByProductId = Object.fromEntries(stockMap);

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
            <div className="text-sm text-slate-600">Total: {total}</div>
          </div>

          <ProductList products={products} stockByProductId={stockByProductId} />
          <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
        </div>
      </div>
    </div>
  );
}
