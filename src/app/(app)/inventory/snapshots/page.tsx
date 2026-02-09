import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { EmptyState } from "@/components/empty-state";
import { PackageSearch } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventorySnapshotsPage() {
  const companyId = await getCompanyIdOrUserId();
  const snapshots = await prisma.inventorySnapshot.findMany({
    where: { companyId },
    orderBy: { importedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Snapshots"
        subtitle="Review import batches, statuses, and reconciliation warnings."
      />

      {snapshots.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No snapshots yet"
          description="Run an inventory import to create the first snapshot."
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-600 bg-slate-50">
                <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <th>Imported At</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Mode</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap) => (
                  <tr key={snap.id} className="border-b last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {snap.importedAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{snap.sourceFileName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700">
                        {snap.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{snap.mode}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-md truncate">
                      {Array.isArray(snap.warnings) && snap.warnings.length > 0
                        ? snap.warnings.join("; ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
