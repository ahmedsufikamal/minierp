import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  LucideIcon,
} from "lucide-react";
import { initChartOfAccountsAction } from "./actions";
import { SalesChart } from "./sales-chart";

export const dynamic = "force-dynamic";

function last6Months(): { month: string; label: string }[] {
  const out: { month: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    out.push({ month, label });
  }
  return out;
}

function StatCard({
  title,
  value,
  href,
  Icon,
}: {
  title: string;
  value: number;
  href: string;
  Icon: LucideIcon;
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
            <Button variant="default" size="sm">
              Open
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const companyId = await getCompanyIdOrUserId();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const [customers, vendors, products, invoices, bills, moves, accounts, entries, invoicesWithLines] =
    await Promise.all([
      (async () => {
        try {
          const result = await prisma.customer.count({ where: { companyId } });
          return result;
        } catch (error) {
          throw error;
        }
      })(),
      prisma.vendor.count({ where: { companyId } }),
      prisma.product.count({ where: { companyId } }),
      prisma.salesInvoice.count({ where: { companyId } }),
      prisma.purchaseBill.count({ where: { companyId } }),
      prisma.inventoryMove.count({ where: { companyId } }),
      prisma.account.count({ where: { companyId } }),
      prisma.journalEntry.count({ where: { companyId } }),
      prisma.salesInvoice.findMany({
        where: { companyId, invoiceDate: { gte: sixMonthsAgo } },
        include: { lines: true },
      }),
    ]);

  const monthLabels = last6Months();
  const byMonth = new Map<string, number>();
  for (const inv of invoicesWithLines) {
    const monthKey = inv.invoiceDate.toISOString().slice(0, 7);
    const total = inv.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + total);
  }
  const salesChartData = monthLabels.map(({ month, label }) => ({
    month,
    label,
    totalCents: byMonth.get(month) ?? 0,
  }));

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
          <Button variant="default">Initialize chart of accounts</Button>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales last 6 months</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={salesChartData} />
        </CardContent>
      </Card>
    </div>
  );
}
