import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/iam";
import { switchOrgAction } from "@/app/(app)/org/actions";
import { Button } from "@/components/ui/button";

export default async function OrgSelectPage() {
  const principal = await requireAuth();
  const memberships = await prisma.companyMembership.findMany({
    where: {
      userId: principal.userId,
      status: "ACTIVE",
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Select organization</h1>
        <p className="text-sm text-muted-foreground">Your account can access multiple tenant workspaces.</p>
      </div>

      <div className="grid gap-3">
        {memberships.map((membership) => (
          <form key={membership.companyId} action={switchOrgAction} className="rounded-lg border p-4">
            <input type="hidden" name="companyId" value={membership.companyId} />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{membership.company.name}</p>
                <p className="text-sm text-muted-foreground">
                  Role: {membership.role} {membership.company.status !== "ACTIVE" ? `(status: ${membership.company.status})` : ""}
                </p>
              </div>
              <Button type="submit" variant={principal.activeCompanyId === membership.companyId ? "secondary" : "default"}>
                {principal.activeCompanyId === membership.companyId ? "Active" : "Switch"}
              </Button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
