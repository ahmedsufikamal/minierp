import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { AddVendorCard, VendorList } from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { getPaginationParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function VendorsPage(props: PageProps) {
  const orgId = await getOrgIdOrUserId();
  const searchParams = (await props.searchParams?.()) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.vendor.count({ where: { orgId } }),
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

          <VendorList vendors={vendors} />
          <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
        </div>
      </div>
    </div>
  );
}
