import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Truck,
  Package,
  FileText,
  Receipt,
  Boxes,
  BookOpen,
} from "lucide-react";
import { initChartOfAccountsAction } from "./actions";

export const dynamic = "force-dynamic";

function StatCard({
  title,
  value,
  href,
  Icon,
}: {
  title: string;
  value: number;
  href: string;
  Icon: any;
}) {
  return (
    <Card className="hover:shadow-md transition">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-sm text-slate-600 dark:text-slate-300">{title}</div>
            <div className="text-3xl font-semibold tracking-tight">{value}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Badge>View</Badge>
          <Link href={href}>
            <Button variant="dark" size="sm">Open</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const orgId = await getOrgIdOrUserId();

  const [
    customers,
    vendors,
    products,
    invoices,
    bills,
    moves,
    accounts,
    entries,
  ] = await Promise.all([
    prisma.customer.count({ where: { orgId } }),
    prisma.vendor.count({ where: { orgId } }),
    prisma.product.count({ where: { orgId } }),
    prisma.salesInvoice.count({ where: { orgId } }),
    prisma.purchaseBill.count({ where: { orgId } }),
    prisma.inventoryMove.count({ where: { orgId } }),
    prisma.account.count({ where: { orgId } }),
    prisma.journalEntry.count({ where: { orgId } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            A quick snapshot of your miniERP data.
          </p>
        </div>

        <form action={initChartOfAccountsAction}>
          <Button variant="dark">Initialize chart of accounts</Button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Customers" value={customers} href="/customers" Icon={Users} />
        <StatCard title="Vendors" value={vendors} href="/vendors" Icon={Truck} />
        <StatCard title="Products" value={products} href="/products" Icon={Package} />
        <StatCard title="Invoices" value={invoices} href="/invoices" Icon={FileText} />
        <StatCard title="Bills" value={bills} href="/bills" Icon={Receipt} />
        <StatCard title="Inventory moves" value={moves} href="/inventory" Icon={Boxes} />
        <StatCard title="Accounts" value={accounts} href="/accounting" Icon={BookOpen} />
        <StatCard title="Journal entries" value={entries} href="/accounting" Icon={BookOpen} />
      </div>
    </div>
  );
}
