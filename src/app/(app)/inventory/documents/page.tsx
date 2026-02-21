import Link from "next/link";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";

export const dynamic = "force-dynamic";

function isMissingSchemaError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return e?.code === "P2021" || e?.code === "P2022" || Boolean(e?.message?.includes("does not exist"));
}

export default async function InventoryDocumentsPage() {
  const ctx = await getInventoryPageContext(inventoryPermissions.documentRead);
  const companyId = ctx.companyId;
  const docsResult = await prisma.inventoryDocument
    .findMany({
      where: { companyId },
      include: {
        lines: true,
        sourceWarehouse: { select: { code: true } },
        destinationWarehouse: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    .then((rows) => ({ rows, needsMigration: false }))
    .catch((error: unknown) => {
      if (isMissingSchemaError(error)) {
        return { rows: [], needsMigration: true };
      }
      throw error;
    });
  const docs = docsResult.rows;
  const needsMigration = docsResult.needsMigration;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title="Inventory Documents" subtitle="Draft, approve, and post stock documents." />
        <Button asChild size="sm">
          <Link href="/inventory/documents/new?type=TRANSFER">New Document</Link>
        </Button>
      </div>

      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-medium text-amber-900">Database Migration Required</div>
          <p className="mt-1 text-sm text-amber-700">
            Inventory document tables are missing in the current database. Run migrations before creating or posting
            documents:
          </p>
          <code className="mt-2 block rounded bg-amber-100 p-2 text-xs text-amber-900">
            npm run prisma:migrate:dev{"\n"}npm run prisma:generate
          </code>
        </div>
      )}

      <section className="surface-1 overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Destination</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{doc.number}</td>
                  <td className="px-3 py-2">{doc.documentType}</td>
                  <td className="px-3 py-2">{doc.status}</td>
                  <td className="px-3 py-2">{doc.sourceWarehouse?.code ?? "-"}</td>
                  <td className="px-3 py-2">{doc.destinationWarehouse?.code ?? "-"}</td>
                  <td className="px-3 py-2">{doc.lines.length}</td>
                  <td className="px-3 py-2">{doc.documentDate.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/inventory/documents/${doc.id}`} className="text-primary hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No documents yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
