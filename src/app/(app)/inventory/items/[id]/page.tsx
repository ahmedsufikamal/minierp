import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { getPaginationParams, getTotalPages } from "@/lib/pagination";
import { ItemDetails, ItemLedger } from "./components";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryItemDetailsPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const params = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });

  let item: any;
  try {
    item = await prisma.product.findFirst({
      where: { id: params.id, companyId },
      include: {
        brand: true,
        category: true,
        subCategory: true,
        balances: {
          include: {
            location: true,
          },
          orderBy: [
            { locationId: { sort: "asc", nulls: "first" } },
          ],
        },
      },
    });
  } catch (error: any) {
    // If brandId column doesn't exist, try without relations
    if (error?.code === 'P2021' || error?.code === 'P2022' || error?.message?.includes('does not exist') || 
        (error?.message?.includes('column') && error?.message?.includes('brandId'))) {
      item = await prisma.product.findFirst({
        where: { id: params.id, companyId },
      });
      if (!item) {
        notFound();
      }
      // Add empty relations for compatibility
      item.brand = { name: 'N/A' };
      item.category = null;
      item.subCategory = null;
      item.balances = [];
    } else {
      throw error;
    }
  }

  if (!item) {
    notFound();
  }

  // Get ledger entries
  let ledgerEntries: any[] = [];
  let ledgerTotal = 0;
  try {
    [ledgerEntries, ledgerTotal] = await Promise.all([
      prisma.stockLedger.findMany({
        where: { companyId, itemId: item.id },
        include: {
          location: true,
        },
        orderBy: { txnDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockLedger.count({
        where: { companyId, itemId: item.id },
      }),
    ]);
  } catch (error: any) {
    // If table doesn't exist, return empty arrays
    if (error?.code === 'P2021' || error?.code === 'P2022' || error?.message?.includes('does not exist')) {
      ledgerEntries = [];
      ledgerTotal = 0;
    } else {
      throw error;
    }
  }

  const totalPages = getTotalPages(ledgerTotal, limit);

  // Calculate overall stock
  const overallBalance = item.balances.find(b => !b.locationId);
  const locationBalances = item.balances.filter(b => b.locationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inventory/items">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Items
          </Link>
        </Button>
      </div>

      <PageHeader
        title={item.name}
        subtitle={`SKU: ${item.sku}${item.brand ? ` | Brand: ${item.brand.name}` : ''}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ItemDetails
            item={item}
            overallBalance={overallBalance}
            locationBalances={locationBalances}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border">
            <div className="p-4 border-b">
              <div className="font-medium">Stock Ledger</div>
              <div className="text-sm text-slate-600">
                Transaction history for this item ({ledgerTotal} entries)
              </div>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="p-8 text-center text-slate-600">
                No ledger entries yet
              </div>
            ) : (
              <>
                <ItemLedger entries={ledgerEntries} />
                <PaginationLinks page={page} totalPages={totalPages} total={ledgerTotal} limit={limit} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
