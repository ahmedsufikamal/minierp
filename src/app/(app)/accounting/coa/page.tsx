import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
  const companyId = await getCompanyIdOrUserId();
  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      rootType: true,
      isGroup: true,
      parentId: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Account hierarchy and root types for general ledger posting."
      />
      <div className="rounded-2xl border">
        <div className="flex items-center justify-between border-b p-4">
          <div className="text-sm text-slate-600">Accounts: {accounts.length}</div>
          <Link href="/accounting" className="text-sm underline underline-offset-4">
            Open accounting workspace
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Root</th>
                <th>Group</th>
                <th>Parent</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{account.code}</td>
                  <td className="px-4 py-3">{account.name}</td>
                  <td className="px-4 py-3">{account.type}</td>
                  <td className="px-4 py-3">{account.rootType ?? account.type}</td>
                  <td className="px-4 py-3">{account.isGroup ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{account.parentId ?? "—"}</td>
                </tr>
              ))}
              {accounts.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={6}>
                    No accounts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
