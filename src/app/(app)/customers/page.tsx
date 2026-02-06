import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { CustomerTable } from "./customer-table";
import { NewCustomerDialog } from "./new-customer-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { Users, UserPlus, TrendingUp } from "lucide-react";
import { getPaginationParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function CustomersPage(props: PageProps) {
  const orgId = await getOrgIdOrUserId();
  const searchParams = (await props.searchParams?.()) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });

  const [customers, total, newThisMonth] = await Promise.all([
    prisma.customer.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where: { orgId } }),
    prisma.customer.count({
      where: {
        orgId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  const totalPages = getTotalPages(total, limit);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Customers" subtitle="Manage your client relationships and details." />
        <NewCustomerDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700">{total}</div>
            <p className="text-xs text-indigo-500/80">Active profiles</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">New This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{newThisMonth}</div>
            <p className="text-xs text-emerald-500/80">+12% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-slate-500">Customers active recently</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
        <CustomerTable customers={customers} />
        <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
      </div>
    </div>
  );
}
