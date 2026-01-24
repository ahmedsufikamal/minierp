import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { AddCustomerCard, DeleteRowButton } from "./components";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const orgId = await getOrgIdOrUserId();

  const customers = await prisma.customer.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Manage your customers and keep invoices organized."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AddCustomerCard />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Customer list</div>
            <div className="text-sm text-slate-600">
              Total: {customers.length}
            </div>
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
                {customers.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">{c.email ?? "—"}</td>
                    <td className="px-4 py-3">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DeleteRowButton id={c.id} />
                    </td>
                  </tr>
                ))}
                {customers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-slate-600" colSpan={4}>
                      No customers yet. Create your first customer on the left.
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
