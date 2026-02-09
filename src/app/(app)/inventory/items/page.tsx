import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { SearchInput } from "@/components/search-input";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { getPaginationParams, getSearchQuery, getTotalPages } from "@/lib/pagination";
import { formatMoney } from "@/lib/utils";
import { InventoryItemsList, InventoryFilters } from "./components";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function InventoryItemsPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });
  const q = getSearchQuery(searchParams as { q?: string });
  const brandFilter = searchParams.brand as string | undefined;
  const categoryFilter = searchParams.category as string | undefined;
  const locationFilter = searchParams.location as string | undefined;

  // Build where clause
  const where: any = { companyId };
  
  if (q) {
    where.OR = [
      { sku: { contains: q, mode: "insensitive" as const } },
      { name: { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
    ];
  }
  
  if (brandFilter) {
    where.brandId = brandFilter;
  }
  
  if (categoryFilter) {
    where.categoryId = categoryFilter;
  }

  // If location filter is set, we'll filter items that have stock in that location
  let locationFilteredItemIds: string[] | undefined;
  if (locationFilter) {
    try {
      const location = await prisma.stockLocation.findFirst({
        where: { companyId, code: locationFilter },
      });
      if (location) {
        const balancesWithLocation = await prisma.stockBalance.findMany({
          where: {
            companyId,
            locationId: location.id,
            qtyOnHand: { gt: 0 },
          },
          select: { itemId: true },
        });
        locationFilteredItemIds = balancesWithLocation.map(b => b.itemId);
        if (locationFilteredItemIds.length === 0) {
          locationFilteredItemIds = [];
        }
      } else {
        locationFilteredItemIds = [];
      }
    } catch (error: any) {
      // If tables don't exist, skip location filtering
      if (error?.code === 'P2021' || error?.code === 'P2022' || error?.message?.includes('does not exist')) {
        locationFilteredItemIds = undefined;
      } else {
        throw error;
      }
    }
  }
  
  if (locationFilteredItemIds !== undefined) {
    where.id = { in: locationFilteredItemIds };
  }

  // Fetch data

  let items: any[] = [], total = 0, brands: any[] = [], categories: any[] = [], locations: any[] = [], stockBalances: any[] = [];
  try {
    [items, total, brands, categories, locations, stockBalances] = await Promise.all([
    (async () => {
      try {
        return await prisma.product.findMany({
          where,
          include: {
            brand: true,
            category: true,
            subCategory: true,
            balances: {
              include: {
                location: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        });
      } catch (error: any) {
        // If brandId column doesn't exist, try without relations
        if (error?.code === 'P2021' || error?.code === 'P2022' || error?.message?.includes('does not exist') || 
            (error?.message?.includes('column') && (error?.message?.includes('brandId') || error?.message?.includes('categoryId') || error?.message?.includes('subCategoryId')))) {
          // Remove brandId/categoryId/subCategoryId from where clause if they don't exist
          const fallbackWhere: any = { companyId };
          if (where.sku) fallbackWhere.sku = where.sku;
          if (where.name) fallbackWhere.name = where.name;
          if (where.id) fallbackWhere.id = where.id;
          return await prisma.product.findMany({
            where: fallbackWhere,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          });
        }
        throw error;
      }
    })(),
    (async () => {
      try {
        return await prisma.product.count({ where });
      } catch (error: any) {
        if (error?.code === 'P2021' || error?.code === 'P2022' || error?.message?.includes('does not exist')) {
          // If columns don't exist, try count without filters that depend on new columns
          try {
            const fallbackWhere: any = { companyId };
            if (where.OR) fallbackWhere.OR = where.OR;
            if (where.id) fallbackWhere.id = where.id;
            return await prisma.product.count({ where: fallbackWhere });
          } catch {
            return 0;
          }
        }
        throw error;
      }
    })(),
    (async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:brandQuery',message:'Querying brands',data:{hasBrand:!!prisma.brand},timestamp:Date.now(),runId:'run4',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      try {
        const result = await prisma.brand.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:brandSuccess',message:'Brands fetched',data:{count:result.length},timestamp:Date.now(),runId:'run4',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return result;
      } catch (error: any) {
        // #region agent log
        const errorCode = error?.code || 'unknown';
        const errorMessage = error instanceof Error ? error.message : 'unknown';
        fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:brandError',message:'Brand query failed',data:{errorCode,errorMessage},timestamp:Date.now(),runId:'run4',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // If table doesn't exist, return empty array instead of throwing
        if (errorCode === 'P2021' || errorMessage?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
    })(),
    (async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:categoryQuery',message:'Querying categories',data:{hasCategory:!!prisma.category},timestamp:Date.now(),runId:'run4',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      try {
        const result = await prisma.category.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:categorySuccess',message:'Categories fetched',data:{count:result.length},timestamp:Date.now(),runId:'run4',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return result;
      } catch (error: any) {
        // #region agent log
        const errorCode = error?.code || 'unknown';
        const errorMessage = error instanceof Error ? error.message : 'unknown';
        fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:categoryError',message:'Category query failed',data:{errorCode,errorMessage},timestamp:Date.now(),runId:'run4',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (errorCode === 'P2021' || errorMessage?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
    })(),
    (async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:locationQuery',message:'Querying stockLocations',data:{hasStockLocation:!!prisma.stockLocation},timestamp:Date.now(),runId:'run4',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      try {
        const result = await prisma.stockLocation.findMany({
          where: { companyId },
          orderBy: { code: "asc" },
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:locationSuccess',message:'StockLocations fetched',data:{count:result.length},timestamp:Date.now(),runId:'run4',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return result;
      } catch (error: any) {
        // #region agent log
        const errorCode = error?.code || 'unknown';
        const errorMessage = error instanceof Error ? error.message : 'unknown';
        fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:locationError',message:'StockLocation query failed',data:{errorCode,errorMessage},timestamp:Date.now(),runId:'run4',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (errorCode === 'P2021' || errorMessage?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
    })(),
    (async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:balanceQuery',message:'Querying stockBalances',data:{hasStockBalance:!!prisma.stockBalance},timestamp:Date.now(),runId:'run4',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      try {
        const result = await prisma.stockBalance.findMany({
          where: { companyId },
          include: {
            item: true,
            location: true,
          },
    });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:balanceSuccess',message:'StockBalances fetched',data:{count:result.length},timestamp:Date.now(),runId:'run4',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return result;
      } catch (error: any) {
        // #region agent log
        const errorCode = error?.code || 'unknown';
        const errorMessage = error instanceof Error ? error.message : 'unknown';
        fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:balanceError',message:'StockBalance query failed',data:{errorCode,errorMessage},timestamp:Date.now(),runId:'run4',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (errorCode === 'P2021' || errorMessage?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
    })(),
  ]);
  } catch (error: any) {
    // #region agent log
    const errorCode = error?.code || 'unknown';
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    fetch('http://127.0.0.1:7242/ingest/b061d0f1-2df2-4f6d-ae4e-558f93eee80c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'inventory/items/page.tsx:fetchError',message:'Database query failed',data:{errorCode,errorMessage},timestamp:Date.now(),runId:'run4',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Check if it's a "table does not exist" error
    if (errorCode === 'P2021' || errorMessage?.includes('does not exist')) {
      // Return empty data with a helpful message
      items = [];
      total = 0;
      brands = [];
      categories = [];
      locations = [];
      stockBalances = [];
    } else {
      throw error;
    }
  }

  // Build stock map (overall + by location)
  const stockMap = new Map<string, { overall: number; byLocation: Record<string, number> }>();
  
  for (const balance of stockBalances) {
    const itemId = balance.itemId;
    if (!stockMap.has(itemId)) {
      stockMap.set(itemId, { overall: 0, byLocation: {} });
    }
    const itemStock = stockMap.get(itemId)!;
    
    if (balance.locationId) {
      const locCode = balance.location?.code || "unknown";
      itemStock.byLocation[locCode] = (itemStock.byLocation[locCode] || 0) + balance.qtyOnHand;
    } else {
      itemStock.overall = balance.qtyOnHand;
    }
  }

  const totalPages = getTotalPages(total, limit);

  // Check if migration is needed (all new tables return empty arrays)
  const needsMigration = brands.length === 0 && categories.length === 0 && locations.length === 0 && stockBalances.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Items"
        subtitle="View and manage inventory items with stock levels by location."
      />

      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-medium text-amber-900 mb-1">Database Migration Required</div>
              <div className="text-sm text-amber-700">
                The inventory tables haven't been created yet. Please run the migration:
              </div>
              <code className="mt-2 block text-xs bg-amber-100 p-2 rounded">
                npx prisma migrate dev
              </code>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border">
        <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-medium">Items ({total})</div>
            <div className="text-sm text-slate-600">
              Showing {items.length} of {total}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <SearchInput
              name="q"
              placeholder="Search by SKU, name, description…"
              defaultValue={q ?? ""}
              className="max-w-sm"
            />
            <InventoryFilters
              brands={brands}
              categories={categories}
              locations={locations}
              brandFilter={brandFilter}
              categoryFilter={categoryFilter}
              locationFilter={locationFilter}
            />
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No items found"
            description={
              q || brandFilter || categoryFilter || locationFilter
                ? "Try adjusting your filters"
                : "Import inventory data or create items manually"
            }
            action={
              <Button asChild>
                <Link href="/inventory/import">Import from Excel</Link>
              </Button>
            }
          />
        ) : (
          <>
            <InventoryItemsList items={items} stockMap={stockMap} locationFilter={locationFilter} />
            <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
          </>
        )}
      </div>
    </div>
  );
}
