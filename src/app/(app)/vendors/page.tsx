import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { AddVendorCard, VendorList } from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Truck } from "lucide-react";
import { getPaginationParams, getSortParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function VendorsPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });
  const { sort, order } = getSortParams(searchParams as { sort?: string; order?: string });
  const sortKey = sort === "name" || sort === "createdAt" ? sort : "createdAt";
  const orderBy = { [sortKey]: order };

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where: { companyId },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.vendor.count({ where: { companyId } }),
  ]);

  const totalPages = getTotalPages(total, limit);

  return (
    <div className="space-y-6">
      <PageHeader title="Vendors" subtitle="Manage suppliers and track your bills." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AddVendorCard />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Vendor list</div>
            <div className="text-sm text-slate-600">Total: {total}</div>
          </div>

          {vendors.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No vendors yet"
              description="Create your first vendor to track bills and purchase orders."
              action={
                <Button asChild>
                  <Link href="#add-vendor">Create first vendor</Link>
                </Button>
              }
            />
          ) : (
            <>
              <VendorList vendors={vendors} sort={sortKey} order={order} />
              <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
