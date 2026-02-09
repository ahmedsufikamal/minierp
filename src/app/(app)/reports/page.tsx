import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ReportsPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};
  const fromParam = (searchParams.from as string) ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const toParam = (searchParams.to as string) ?? new Date().toISOString().slice(0, 10);
  const from = new Date(fromParam);
  const to = new Date(toParam);
  if (isNaN(from.getTime())) from.setTime(new Date(new Date().getFullYear(), 0, 1).getTime());
  if (isNaN(to.getTime())) to.setTime(Date.now());

  const [
    salesByCustomer,
    purchasesByVendor,
    invoiceTotals,
    billTotals,
    paymentsIn,
    paymentsOut,
    journalSummary,
  ] = await Promise.all([
    prisma.salesInvoice.groupBy({
      by: ["customerId"],
      where: { companyId, invoiceDate: { gte: from, lte: to } },
      _count: { id: true },
    }),
    prisma.purchaseBill.groupBy({
      by: ["vendorId"],
      where: { companyId, billDate: { gte: from, lte: to } },
      _count: { id: true },
    }),
    prisma.salesInvoice.findMany({
      where: { companyId, invoiceDate: { gte: from, lte: to } },
      include: { lines: true, customer: { select: { name: true } } },
    }),
    prisma.purchaseBill.findMany({
      where: { companyId, billDate: { gte: from, lte: to } },
      include: { lines: true, vendor: { select: { name: true } } },
    }),
    prisma.payment.aggregate({
      where: { companyId, type: "INBOUND", date: { gte: from, lte: to } },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { companyId, type: "OUTBOUND", date: { gte: from, lte: to } },
      _sum: { amountCents: true },
    }),
    prisma.journalLine.findMany({
      where: { entry: { companyId, date: { gte: from, lte: to } } },
      include: { account: true },
    }),
  ]);

  const salesTotalCents = invoiceTotals.reduce(
    (sum, inv) => sum + inv.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0),
    0,
  );
  const purchasesTotalCents = billTotals.reduce(
    (sum, b) => sum + b.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0),
    0,
  );

  const byAccount = new Map<string, { debit: number; credit: number; name: string; type: string }>();
  for (const line of journalSummary) {
    const key = line.accountId;
    if (!byAccount.has(key)) {
      byAccount.set(key, {
        debit: 0,
        credit: 0,
        name: line.account.name,
        type: line.account.type,
      });
    }
    const acc = byAccount.get(key)!;
    acc.debit += line.debitCents;
    acc.credit += line.creditCents;
  }

  const incomeCents = Array.from(byAccount.values())
    .filter((a) => a.type === "INCOME")
    .reduce((s, a) => s + a.credit - a.debit, 0);
  const expenseCents = Array.from(byAccount.values())
    .filter((a) => a.type === "EXPENSE")
    .reduce((s, a) => s + a.debit - a.credit, 0);
  const profitCents = incomeCents - expenseCents;

  const customerIds = [...new Set(salesByCustomer.map((s) => s.customerId))];
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true },
  });
  const customerNames = Object.fromEntries(customers.map((c) => [c.id, c.name]));

  const vendorIds = [...new Set(purchasesByVendor.map((s) => s.vendorId))];
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  const vendorNames = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

  const salesByCustomerRows = salesByCustomer.map((s) => {
    const invs = invoiceTotals.filter((i) => i.customerId === s.customerId);
    const total = invs.reduce(
      (sum, inv) => sum + inv.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0),
      0,
    );
    return { customerName: customerNames[s.customerId] ?? "—", count: s._count.id, totalCents: total };
  });

  const purchasesByVendorRows = purchasesByVendor.map((s) => {
    const bills = billTotals.filter((b) => b.vendorId === s.vendorId);
    const total = bills.reduce(
      (sum, b) => sum + b.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0),
      0,
    );
    return { vendorName: vendorNames[s.vendorId] ?? "—", count: s._count.id, totalCents: total };
  });

  const unpaidInvoices = await prisma.salesInvoice.findMany({
    where: { companyId, status: { not: "PAID" } },
    include: { lines: true, customer: { select: { name: true } } },
  });
  const invoicePayments = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: { companyId, invoiceId: { not: null } },
    _sum: { amountCents: true },
  });
  const paidByInvoice = Object.fromEntries(
    invoicePayments.map((p) => [p.invoiceId!, p._sum.amountCents ?? 0]),
  );
  const agedReceivables = unpaidInvoices.map((inv) => {
    const total = inv.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
    const paid = paidByInvoice[inv.id] ?? 0;
    const due = total - paid;
    return {
      number: inv.number,
      customerName: inv.customer.name,
      dueDate: inv.dueDate,
      totalCents: total,
      paidCents: paid,
      dueCents: due,
    };
  });

  const unpaidBills = await prisma.purchaseBill.findMany({
    where: { companyId, status: { not: "PAID" } },
    include: { lines: true, vendor: { select: { name: true } } },
  });
  const billPayments = await prisma.payment.groupBy({
    by: ["billId"],
    where: { companyId, billId: { not: null } },
    _sum: { amountCents: true },
  });
  const paidByBill = Object.fromEntries(
    billPayments.map((p) => [p.billId!, p._sum.amountCents ?? 0]),
  );
  const agedPayables = unpaidBills.map((bill) => {
    const total = bill.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
    const paid = paidByBill[bill.id] ?? 0;
    const due = total - paid;
    return {
      number: bill.number,
      vendorName: bill.vendor.name,
      dueDate: bill.dueDate,
      totalCents: total,
      paidCents: paid,
      dueCents: due,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Sales, P&amp;L, and aged receivables/payables." />

      <ReportsClient
        defaultFrom={fromParam}
        defaultTo={toParam}
        salesTotalCents={salesTotalCents}
        purchasesTotalCents={purchasesTotalCents}
        paymentsInCents={paymentsIn._sum.amountCents ?? 0}
        paymentsOutCents={paymentsOut._sum.amountCents ?? 0}
        profitCents={profitCents}
        incomeCents={incomeCents}
        expenseCents={expenseCents}
        salesByCustomer={salesByCustomerRows}
        purchasesByVendor={purchasesByVendorRows}
        agedReceivables={agedReceivables}
        agedPayables={agedPayables}
      />
    </div>
  );
}
