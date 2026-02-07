import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { getStockByProduct } from "@/lib/inventory";
import { AddProductCard, ProductList } from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { getPaginationParams, getSearchQuery, getSortParams, getTotalPages } from "@/lib/pagination";
import { SearchInput } from "@/components/search-input";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductsPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });
  const { sort, order } = getSortParams(searchParams as { sort?: string; order?: string });
  const q = getSearchQuery(searchParams as { q?: string });
  const sortKey =
    sort === "name" || sort === "sku" || sort === "createdAt" || sort === "priceCents"
      ? sort
      : "createdAt";
  const orderBy = { [sortKey]: order };
  const where = q
    ? {
        companyId,
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { sku: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { companyId };

  let products: any[] = [], total = 0, brands: any[] = [];
  let stockMap: Map<string, number>;
  try {
    const results = await Promise.all([
      (async () => {
        try {
          return await prisma.product.findMany({
            where,
            include: {
              brand: true,
            },
            orderBy,
            skip,
            take: limit,
          });
        } catch (error: any) {
          // If brandId column doesn't exist, try without brand relation
          if (error?.code === 'P2021' || error?.message?.includes('does not exist') || 
              (error?.message?.includes('column') && error?.message?.includes('brandId'))) {
            return await prisma.product.findMany({
              where,
              orderBy,
              skip,
              take: limit,
            });
          }
          throw error;
        }
      })(),
      prisma.product.count({ where }),
      getStockByProduct(companyId).catch(() => new Map()),
      (async () => {
        try {
          return await prisma.brand.findMany({
            where: { companyId },
            orderBy: { name: "asc" },
          });
        } catch (error: any) {
          if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
            return [];
          }
          throw error;
        }
      })(),
    ]);
    products = results[0];
    total = results[1];
    stockMap = results[2] as Map<string, number>;
    brands = results[3];
  } catch (error: any) {
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      products = [];
      total = 0;
      brands = [];
      stockMap = new Map();
    } else {
      throw error;
    }
  }

  const totalPages = getTotalPages(total, limit);
  const stockByProductId = stockMap instanceof Map ? Object.fromEntries(stockMap) : {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle="Catalog items used in invoices, bills, and inventory."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AddProductCard brands={brands} />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-medium">Product list</div>
              <div className="text-sm text-slate-600">Total: {total}</div>
            </div>
            <SearchInput name="q" placeholder="Search products…" defaultValue={q ?? ""} className="max-w-sm" />
          </div>

          {products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add products to use in invoices, bills, and inventory."
              action={
                <Button asChild>
                  <Link href="#add-product">Create first product</Link>
                </Button>
              }
            />
          ) : (
            <>
              <ProductList products={products} stockByProductId={stockByProductId} sort={sortKey} order={order} brands={brands} />
              <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
