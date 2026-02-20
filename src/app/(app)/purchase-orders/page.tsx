import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import {
  NewPOCard,
  POStatusSelect,
  DeletePOButton,
  ConvertToBillButton,
  POTableHead,
} from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";
import { getPaginationParams, getSortParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function PurchaseOrdersPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });
  const { sort, order } = getSortParams(searchParams as { sort?: string; order?: string });
  const sortKey =
    sort === "number" || sort === "orderDate" || sort === "createdAt" ? sort : "createdAt";
  const orderBy = { [sortKey]: order };

  const [orders, total, vendors, products] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { companyId },
      include: { vendor: true, lines: true },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where: { companyId } }),
    prisma.vendor.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { companyId },
      select: { id: true, sku: true, name: true, uom: true, priceCents: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = getTotalPages(total, limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Create POs, receive inventory, and convert to bills."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NewPOCard vendors={vendors} products={products} />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Purchase order list</div>
            <div className="text-sm text-muted-foreground">Total: {total}</div>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No purchase orders yet"
              description="Create POs, receive inventory, and convert to bills."
              action={
                <Button asChild>
                  <Link href="#add-po">Create first purchase order</Link>
                </Button>
              }
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <POTableHead sort={sortKey} order={order} />
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/purchase-orders/${order.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {order.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{order.vendor.name}</td>
                    <td className="px-4 py-3">
                      <POStatusSelect id={order.id} currentStatus={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(
                        order.lines.reduce(
                          (acc, line) => acc + line.qtyOrdered * line.unitPriceCents,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ConvertToBillButton orderId={order.id} status={order.status} />
                    </td>
                    <td className="px-4 py-3 flex gap-1">
                      <DeletePOButton id={order.id} status={order.status} label={order.number} />
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-muted-foreground" colSpan={6}>
                      No purchase orders yet. Create one on the left.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          )}
          {orders.length > 0 && (
            <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
          )}
        </div>
      </div>
    </div>
  );
}
