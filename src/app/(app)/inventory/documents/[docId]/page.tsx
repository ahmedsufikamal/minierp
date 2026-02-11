import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { InventoryDocumentActions } from "./doc-actions";
import { DocumentAttachmentPanel } from "./document-attachment-panel";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ docId: string }> };

export default async function InventoryDocumentPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const { docId } = await props.params;

  const [doc, attachments, ledger] = await Promise.all([
    prisma.inventoryDocument.findFirst({
      where: { id: docId, companyId },
      include: {
        sourceWarehouse: true,
        destinationWarehouse: true,
        lines: {
          include: {
            item: { select: { sku: true, name: true, uom: true } },
          },
          orderBy: { lineNo: "asc" },
        },
        workflow: true,
      },
    }),
    prisma.inventoryAttachment.findMany({
      where: { companyId, entityType: "DOCUMENT", entityId: docId },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.inventoryLedgerEntry.findMany({
      where: { companyId, documentId: docId },
      include: {
        warehouse: true,
        location: true,
        item: { select: { sku: true, name: true } },
      },
      orderBy: { postingTime: "desc" },
    }),
  ]);

  if (!doc) notFound();

  const totalValueMinor = doc.lines.reduce(
    (sum, line) => sum + Math.abs(line.quantity) * (line.unitCostMinor ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/inventory/documents">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to documents
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${doc.number} (${doc.documentType})`}
        subtitle={`Status: ${doc.status} | Total value: ${formatMoney(totalValueMinor, "BDT")}`}
      />

      <section className="surface-1 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Document Date: {doc.documentDate.toISOString().slice(0, 10)}</p>
            <p>Source: {doc.sourceWarehouse?.code ?? "-"}</p>
            <p>Destination: {doc.destinationWarehouse?.code ?? "-"}</p>
          </div>
          <InventoryDocumentActions docId={doc.id} status={doc.status} />
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Line</th>
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">Qty</th>
                <th className="px-2 py-1.5">Unit Cost</th>
                <th className="px-2 py-1.5">Line Value</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="px-2 py-1.5">{line.lineNo}</td>
                  <td className="px-2 py-1.5">{line.item.sku} - {line.item.name}</td>
                  <td className="px-2 py-1.5">{line.quantity}</td>
                  <td className="px-2 py-1.5">{formatMoney(line.unitCostMinor ?? 0, "BDT")}</td>
                  <td className="px-2 py-1.5">{formatMoney(Math.abs(line.quantity) * (line.unitCostMinor ?? 0), "BDT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-1 p-4">
        <h2 className="mb-2 text-sm font-semibold">Ledger Postings</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Time</th>
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">Warehouse</th>
                <th className="px-2 py-1.5">Location</th>
                <th className="px-2 py-1.5">Delta</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-2 py-1.5">{entry.postingTime.toLocaleString()}</td>
                  <td className="px-2 py-1.5">{entry.item.sku}</td>
                  <td className="px-2 py-1.5">{entry.warehouse.code}</td>
                  <td className="px-2 py-1.5">{entry.location?.code ?? "-"}</td>
                  <td className="px-2 py-1.5 font-medium">{entry.quantityDelta}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-muted-foreground">
                    This document is not posted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DocumentAttachmentPanel
        docId={doc.id}
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
