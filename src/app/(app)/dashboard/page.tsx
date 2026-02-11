import Link from "next/link";
import { AlertTriangle, ArrowRight, PackageSearch, Receipt, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Banner } from "@/components/ui/Banner";
import { SalesChart } from "./sales-chart";
import { initChartOfAccountsAction } from "./actions";
import { DashboardGrids, type DashboardLowStockRow, type DashboardOverdueInvoiceRow } from "./dashboard-grids";

export const dynamic = "force-dynamic";

function monthSeries() {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    return {
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    };
  });
}

export default async function DashboardPage() {
  const companyId = await getCompanyIdOrUserId();

  const [customers, vendors, products, invoices, bills, payments, accounts, entries, invoicesWithLines, unpaidInvoices, invoicePayments, lowStockBalances] =
    await Promise.all([
      prisma.customer.count({ where: { companyId } }),
      prisma.vendor.count({ where: { companyId } }),
      prisma.product.count({ where: { companyId } }),
      prisma.salesInvoice.count({ where: { companyId } }),
      prisma.purchaseBill.count({ where: { companyId } }),
      prisma.payment.count({ where: { companyId } }),
      prisma.account.count({ where: { companyId } }),
      prisma.journalEntry.count({ where: { companyId } }),
      prisma.salesInvoice.findMany({ where: { companyId }, include: { lines: true } }),
      prisma.salesInvoice.findMany({
        where: { companyId, status: { not: "PAID" } },
        include: { lines: true, customer: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: 8,
      }),
      prisma.payment.groupBy({
        by: ["invoiceId"],
        where: { companyId, invoiceId: { not: null } },
        _sum: { amountCents: true },
      }),
      prisma.stockBalance.findMany({
        where: { companyId, locationId: null, item: { lowStockThreshold: { not: null } } },
        include: { item: true },
        orderBy: { qtyOnHand: "asc" },
        take: 8,
      }),
    ]);

  const paidByInvoice = Object.fromEntries(invoicePayments.map((p) => [p.invoiceId ?? "", p._sum.amountCents ?? 0]));

  const overdueInvoices: DashboardOverdueInvoiceRow[] = unpaidInvoices.map((invoice) => {
    const total = invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
    const paid = paidByInvoice[invoice.id] ?? 0;
    return {
      id: invoice.id,
      number: invoice.number,
      customerName: invoice.customer.name,
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
      amountDueCents: Math.max(0, total - paid),
    };
  });

  const lowStockRows: DashboardLowStockRow[] = lowStockBalances
    .map((balance) => ({
      id: balance.item.id,
      name: balance.item.name,
      sku: balance.item.sku,
      qty: balance.qtyOnHand,
      threshold: balance.item.lowStockThreshold ?? 0,
    }))
    .filter((row) => row.qty <= row.threshold);

  const monthly = monthSeries();
  const revenueByMonth = new Map<string, number>();
  invoicesWithLines.forEach((invoice) => {
    const month = invoice.invoiceDate.toISOString().slice(0, 7);
    const total = invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
    revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + total);
  });
  const salesChartData = monthly.map((m) => ({ month: m.month, label: m.label, totalCents: revenueByMonth.get(m.month) ?? 0 }));

  const kpis = [
    { label: "Customers", value: customers, href: "/customers", note: "Active accounts" },
    { label: "Vendors", value: vendors, href: "/vendors", note: "Purchasing network" },
    { label: "Products", value: products, href: "/products", note: "Catalog items" },
    { label: "Invoices", value: invoices, href: "/invoices", note: "Issued documents" },
    { label: "Bills", value: bills, href: "/bills", note: "Payables" },
    { label: "Payments", value: payments, href: "/payments", note: "Cash movement" },
    { label: "Accounts", value: accounts, href: "/accounting", note: "Chart configured" },
    { label: "Journal Entries", value: entries, href: "/accounting", note: "Ledger activity" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="Operational view of sales, inventory, and accounting health."
        actions={(
          <>
            <Button asChild size="sm"><Link href="/invoices">Create invoice</Link></Button>
            <Button variant="outline" size="sm"><Upload className="mr-1 h-4 w-4" /> Import inventory</Button>
          </>
        )}
      />

      <Banner
        title="Complete accounting setup"
        description="Initialize chart of accounts to enable full ledger and reporting workflows."
        action={
          <form action={initChartOfAccountsAction}>
            <Button size="sm">Initialize now</Button>
          </form>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="surface-2 block p-3 hover:bg-[hsl(var(--surface-3))]">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-2xl font-semibold">{kpi.value.toLocaleString()}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
          </Link>
        ))}
      </div>

      <DashboardGrids overdueInvoices={overdueInvoices} lowStockRows={lowStockRows} />

      <section className="surface-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sales trend</h2>
          <span className="text-xs text-muted-foreground">Last 6 months</span>
        </div>
        {salesChartData.some((point) => point.totalCents > 0) ? (
          <SalesChart data={salesChartData} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <PackageSearch className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">No sales data yet</p>
            <p className="text-sm text-muted-foreground">Create an invoice to populate your trend insights.</p>
            <Button asChild size="sm"><Link href="/invoices"><Receipt className="mr-1 h-4 w-4" /> Create invoice</Link></Button>
          </div>
        )}
      </section>

      {lowStockRows.length > 0 && (
        <div className="surface-2 flex items-center gap-2 p-3 text-sm text-[hsl(var(--warning))]">
          <AlertTriangle className="h-4 w-4" />
          {lowStockRows.length} item(s) need replenishment attention.
        </div>
      )}
    </div>
  );
}
