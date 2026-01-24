import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { AddVendorCard, DeleteRowButton } from "./components";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const orgId = await getOrgIdOrUserId();

  const vendors = await prisma.vendor.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Vendors" subtitle="Manage suppliers and track your bills." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AddVendorCard />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Vendor list</div>
            <div className="text-sm text-slate-600">Total: {vendors.length}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th className="w-[90px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3">{v.email ?? "—"}</td>
                    <td className="px-4 py-3">{v.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DeleteRowButton id={v.id} />
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-slate-600" colSpan={4}>
                      No vendors yet. Create your first vendor on the left.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
