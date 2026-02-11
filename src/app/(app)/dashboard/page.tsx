import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  gradient = false,
}: {
  title: string;
  value: number;
  href: string;
  Icon: LucideIcon;
  gradient?: boolean;
}) {
  return (
    <Card variant={gradient ? "gradient" : "elevated"} className="group hover:scale-[1.02] transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</div>
            <div className="text-4xl font-bold tracking-tight text-foreground">{value.toLocaleString()}</div>
          </div>
          <div className={cn(
            "rounded-xl p-3 transition-transform duration-200 group-hover:scale-110",
            gradient 
              ? "bg-primary/20 text-primary" 
              : "bg-primary/10 text-primary border border-primary/20"
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between pt-4 border-t border-border/50">
          <Badge variant="secondary" className="text-xs">View details</Badge>
          <Link href={href}>
            <Button variant="ghost" size="sm" className="h-8">
              Open →
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
          return await prisma.customer.count({ where: { companyId } });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.customer.count({ where: { orgId: companyId } });
          }
          throw error;
        }
      })(),
      (async () => {
        try {
          return await prisma.vendor.count({ where: { companyId } });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.vendor.count({ where: { orgId: companyId } });
          }
          throw error;
        }
      })(),
      (async () => {
        try {
          return await prisma.product.count({ where: { companyId } });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.product.count({ where: { orgId: companyId } });
          }
          throw error;
        }
      })(),
      (async () => {
        try {
          return await prisma.salesInvoice.count({ where: { companyId } });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.salesInvoice.count({ where: { orgId: companyId } });
          }
          throw error;
        }
      })(),
      (async () => {
        try {
          return await prisma.purchaseBill.count({ where: { companyId } });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.purchaseBill.count({ where: { orgId: companyId } });
          }
          throw error;
        }
      })(),
      (async () => {
        try {
          return await prisma.inventoryMove.count({ where: { companyId } });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.inventoryMove.count({ where: { orgId: companyId } });
          }
          throw error;
        }
      })(),
      (async () => {
        try {
          return await prisma.account.count({ where: { companyId } });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.account.count({ where: { orgId: companyId } });
          }
          throw error;
        }
      })(),
      (async () => {
        try {
          return await prisma.journalEntry.count({ where: { companyId } });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.journalEntry.count({ where: { orgId: companyId } });
          }
          throw error;
        }
      })(),
      (async () => {
        try {
          return await prisma.salesInvoice.findMany({
            where: { companyId, invoiceDate: { gte: sixMonthsAgo } },
            include: { lines: true },
          });
        } catch (error: any) {
          if (error?.message?.includes("Unknown argument `companyId`")) {
            return await prisma.salesInvoice.findMany({
              where: { orgId: companyId, invoiceDate: { gte: sixMonthsAgo } },
              include: { lines: true },
            });
          }
          throw error;
        }
      })(),
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            A quick snapshot of your miniERP data and performance metrics.
          </p>
        </div>

        <form action={initChartOfAccountsAction}>
          <Button variant="gradient">Initialize chart of accounts</Button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Customers" value={customers} href="/customers" Icon={Users} gradient />
        <StatCard title="Vendors" value={vendors} href="/vendors" Icon={Truck} />
        <StatCard title="Products" value={products} href="/products" Icon={Package} />
        <StatCard title="Invoices" value={invoices} href="/invoices" Icon={FileText} gradient />
        <StatCard title="Bills" value={bills} href="/bills" Icon={Receipt} />
        <StatCard title="Inventory moves" value={moves} href="/inventory" Icon={Boxes} />
        <StatCard title="Accounts" value={accounts} href="/accounting" Icon={BookOpen} />
        <StatCard title="Journal entries" value={entries} href="/accounting" Icon={BookOpen} />
      </div>

      <Card variant="elevated">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Sales Overview</CardTitle>
          <p className="text-sm text-muted-foreground">Last 6 months revenue trend</p>
        </CardHeader>
        <CardContent>
          <SalesChart data={salesChartData} />
        </CardContent>
      </Card>
    </div>
  );
}
