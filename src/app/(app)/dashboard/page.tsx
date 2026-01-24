import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { InitAccountsButton } from "./components";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Card({
  title,
  value,
  href,
}: {
  title: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border p-5 hover:shadow-sm transition"
    >
      <div className="text-sm text-slate-600">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-3 text-xs text-slate-500">View →</div>
    </Link>
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
      <PageHeader
        title="Dashboard"
        subtitle="Quick snapshot of your miniERP data."
        actions={<InitAccountsButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Customers" value={customers} href="/customers" />
        <Card title="Vendors" value={vendors} href="/vendors" />
        <Card title="Products" value={products} href="/products" />
        <Card title="Invoices" value={invoices} href="/invoices" />
        <Card title="Bills" value={bills} href="/bills" />
        <Card title="Inventory moves" value={moves} href="/inventory" />
        <Card title="Accounts" value={accounts} href="/accounting" />
        <Card title="Journal entries" value={entries} href="/accounting" />
      </div>
    </div>
  );
}
