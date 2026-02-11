import { InventoryCustomFieldEntityType } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { ItemAttachmentPanel } from "./attachment-panel";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function InventoryItemDetailPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const { id } = await props.params;

  const [item, customValues, ledgerEntries, attachments] = await Promise.all([
    prisma.product.findFirst({
      where: { id, companyId },
      include: {
        brand: true,
        category: true,
        subCategory: true,
        inventoryItemIdentifiers: true,
        inventoryStockBalances: {
          include: {
            warehouse: true,
            location: true,
          },
          orderBy: [{ warehouse: { code: "asc" } }, { location: { code: "asc" } }],
        },
      },
    }),
    prisma.inventoryCustomFieldValue.findMany({
      where: {
        companyId,
        entityType: InventoryCustomFieldEntityType.ITEM,
        entityId: id,
      },
      include: {
        fieldDefinition: { select: { key: true, label: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.inventoryLedgerEntry.findMany({
      where: { companyId, itemId: id },
      include: {
        warehouse: true,
        location: true,
      },
      orderBy: { postingTime: "desc" },
      take: 100,
    }),
    prisma.inventoryAttachment.findMany({
      where: { companyId, entityType: "ITEM", entityId: id },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  if (!item) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/inventory/items">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to items
          </Link>
        </Button>
      </div>

      <section className="surface-1 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{item.name}</h1>
            <p className="text-sm text-muted-foreground">
              SKU: <span className="font-mono">{item.sku}</span> | Brand: {item.brand.name}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href={`/inventory/documents/new?type=RECEIPT&itemId=${item.id}`}>Create movement</Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-muted-foreground">UOM</div>
            <div className="font-medium">{item.uom}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Unit Cost</div>
            <div className="font-medium">{formatMoney(item.unitCostMinor ?? 0, "BDT")}</div>
          </div>
          <div>
            <div className="text-muted-foreground">List Price</div>
            <div className="font-medium">{formatMoney(item.priceCents, "BDT")}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Status</div>
            <div className="font-medium">{item.isActive ? "Active" : "Archived"}</div>
          </div>
        </div>
      </section>

      <section className="surface-1 p-4">
        <h2 className="mb-3 text-sm font-semibold">Custom Fields</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {customValues.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border p-2 text-sm">
              <div className="text-muted-foreground">{entry.fieldDefinition.label}</div>
              <div>{typeof entry.value === "object" ? JSON.stringify(entry.value) : String(entry.value)}</div>
            </div>
          ))}
          {customValues.length === 0 && <p className="text-sm text-muted-foreground">No custom field values.</p>}
        </div>
      </section>

      <section className="surface-1 p-4">
        <h2 className="mb-3 text-sm font-semibold">Identifiers</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {item.inventoryItemIdentifiers.map((identifier) => (
            <div key={identifier.id} className="rounded-md border border-border p-2 text-sm">
              <div className="text-muted-foreground">{identifier.kind}</div>
              <div className="font-mono text-xs">{identifier.value}</div>
            </div>
          ))}
          {item.inventoryItemIdentifiers.length === 0 && (
            <p className="text-sm text-muted-foreground">No barcode/QR identifiers yet.</p>
          )}
        </div>
      </section>

      <section className="surface-1 p-4">
        <h2 className="mb-3 text-sm font-semibold">Warehouse Balances</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Warehouse</th>
                <th className="px-2 py-1.5">Location</th>
                <th className="px-2 py-1.5">On Hand</th>
                <th className="px-2 py-1.5">Reserved</th>
                <th className="px-2 py-1.5">Incoming</th>
                <th className="px-2 py-1.5">Outgoing</th>
                <th className="px-2 py-1.5">Avg Cost</th>
              </tr>
            </thead>
            <tbody>
              {item.inventoryStockBalances.map((balance) => (
                <tr key={balance.id} className="border-t border-border">
                  <td className="px-2 py-1.5">{balance.warehouse.code}</td>
                  <td className="px-2 py-1.5">{balance.location?.code ?? "-"}</td>
                  <td className="px-2 py-1.5">{balance.onHand.toLocaleString()}</td>
                  <td className="px-2 py-1.5">{balance.reserved.toLocaleString()}</td>
                  <td className="px-2 py-1.5">{balance.incoming.toLocaleString()}</td>
                  <td className="px-2 py-1.5">{balance.outgoing.toLocaleString()}</td>
                  <td className="px-2 py-1.5">{formatMoney(balance.avgCostMinor ?? 0, "BDT")}</td>
                </tr>
              ))}
              {item.inventoryStockBalances.length === 0 && (
                <tr>
                  <td className="px-2 py-4 text-muted-foreground" colSpan={7}>
                    No stock balance rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-1 p-4">
        <h2 className="mb-3 text-sm font-semibold">Ledger History</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Time</th>
                <th className="px-2 py-1.5">Warehouse</th>
                <th className="px-2 py-1.5">Location</th>
                <th className="px-2 py-1.5">Delta</th>
                <th className="px-2 py-1.5">Unit Cost</th>
                <th className="px-2 py-1.5">Doc</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-2 py-1.5">{entry.postingTime.toLocaleString()}</td>
                  <td className="px-2 py-1.5">{entry.warehouse.code}</td>
                  <td className="px-2 py-1.5">{entry.location?.code ?? "-"}</td>
                  <td className="px-2 py-1.5 font-medium">{entry.quantityDelta}</td>
                  <td className="px-2 py-1.5">{formatMoney(entry.unitCostMinor ?? 0, "BDT")}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{entry.documentId?.slice(0, 8) ?? "-"}</td>
                </tr>
              ))}
              {ledgerEntries.length === 0 && (
                <tr>
                  <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
                    No ledger entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ItemAttachmentPanel
        itemId={item.id}
        initial={attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          uploadedAt: attachment.uploadedAt.toISOString(),
        }))}
      />
    </div>
  );
}
