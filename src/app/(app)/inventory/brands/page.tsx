import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { createBrand, deleteBrand } from "./actions";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventoryBrandsPage() {
  const companyId = await getCompanyIdOrUserId();
  const brands = await prisma.brand.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Brands" subtitle="Manage inventory brands." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-2xl border p-5">
          <div className="font-medium mb-3">Add brand</div>
          <form action={createBrand} className="grid gap-3">
            <input
              name="name"
              placeholder="Brand name"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
            <Button type="submit">Create</Button>
          </form>
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Brand list</div>
            <div className="text-sm text-muted-foreground">Total: {brands.length}</div>
          </div>
          {brands.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No brands yet"
              description="Create your first brand to categorize inventory."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                    <th>Name</th>
                    <th className="w-[120px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((brand) => {
                    const deleteBrandAction = deleteBrand.bind(null, brand.id);
                    return (
                      <tr key={brand.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{brand.name}</td>
                        <td className="px-4 py-3">
                          <form action={deleteBrandAction}>
                            <Button type="submit" variant="utility" size="xs">Delete</Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
