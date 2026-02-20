import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountingPeriodsPage() {
  const companyId = await getCompanyIdOrUserId();
  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { companyId },
    include: {
      periods: {
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { startDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Fiscal Years & Periods" subtitle="Posting is allowed only in open fiscal years and periods." />
      <div className="rounded-2xl border">
        <div className="border-b p-4 text-sm text-slate-600">Fiscal years: {fiscalYears.length}</div>
        <div className="divide-y">
          {fiscalYears.map((fy) => (
            <div key={fy.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{fy.name}</div>
                <div className="text-xs text-slate-600">
                  {fy.startDate.toISOString().slice(0, 10)} to {fy.endDate.toISOString().slice(0, 10)}{" "}
                  {fy.isClosed ? "(Closed)" : "(Open)"}
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-600">
                    <tr className="[&>th]:px-3 [&>th]:py-2 border-b">
                      <th>Period</th>
                      <th>Range</th>
                      <th>Status</th>
                      <th>Year End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fy.periods.map((period) => (
                      <tr key={period.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{period.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {period.startDate.toISOString().slice(0, 10)} to {period.endDate.toISOString().slice(0, 10)}
                        </td>
                        <td className="px-3 py-2">{period.status}</td>
                        <td className="px-3 py-2">{period.isYearEnd ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                    {fy.periods.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-slate-600" colSpan={4}>
                          No periods found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {fiscalYears.length === 0 ? (
            <div className="p-8 text-sm text-slate-600">No fiscal years found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
