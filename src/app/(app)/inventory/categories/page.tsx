import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { createCategory, deleteCategory } from "./actions";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventoryCategoriesPage() {
  const companyId = await getCompanyIdOrUserId();
  const categories = await prisma.category.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { subCategories: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" subtitle="Manage inventory categories." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-2xl border p-5">
          <div className="font-medium mb-3">Add category</div>
          <form action={createCategory} className="grid gap-3">
            <input
              name="name"
              placeholder="Category name"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
            <Button type="submit">Create</Button>
          </form>
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Category list</div>
            <div className="text-sm text-muted-foreground">Total: {categories.length}</div>
          </div>
          {categories.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No categories yet"
              description="Create your first category to group items."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                    <th>Name</th>
                    <th>Subcategories</th>
                    <th className="w-[120px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{category.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {category.subCategories.length > 0
                          ? category.subCategories.map((s) => s.name).join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <form action={async () => deleteCategory(category.id)}>
                          <Button type="submit" variant="utility" size="xs">Delete</Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
