import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { ReceiveLineForm } from "../receive-line-form";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const companyId = await getCompanyIdOrUserId();
  const { id } = await params;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: { vendor: true, lines: { include: { product: true } } },
  });

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/purchase-orders" className="text-sm text-muted-foreground hover:underline">
            ← Purchase orders
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            {order.number} — {order.vendor.name}
          </h1>
          <p className="text-sm text-muted-foreground">Status: {order.status}</p>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-[hsl(var(--surface-elevated))] font-medium">Line items</div>
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
              <th>Product / Description</th>
              <th>Ordered</th>
              <th>Received</th>
              <th>Unit price</th>
              <th>Receive</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {line.product ? `${line.product.name} (${line.product.sku})` : line.description}
                  </div>
                </td>
                <td className="px-4 py-3">{line.qtyOrdered}</td>
                <td className="px-4 py-3">{line.qtyReceived}</td>
                <td className="px-4 py-3">{formatMoney(line.unitPriceCents)}</td>
                <td className="px-4 py-3">
                  {line.productId && line.qtyReceived < line.qtyOrdered ? (
                    <ReceiveLineForm
                      lineId={line.id}
                      maxQty={line.qtyOrdered - line.qtyReceived}
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      {line.qtyReceived >= line.qtyOrdered ? "Fully received" : "No product"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
