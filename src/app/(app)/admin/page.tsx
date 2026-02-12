import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/modules/iam";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function PlatformAdminPage(props: PageProps) {
  await requirePlatformAdmin();
  const searchParams = (await props.searchParams) ?? {};
  const query = String(searchParams.q ?? "").trim();

  const [users, tenants, audits] = await Promise.all([
    prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { id: { contains: query } },
              { phone: { contains: query } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        memberships: {
          include: {
            company: { select: { id: true, name: true, status: true } },
          },
          take: 10,
        },
      },
    }),
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        primaryDomain: true,
        domainVerificationStatus: true,
      },
    }),
    prisma.iamAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        companyId: true,
        actorUserId: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform admin console</h1>
        <p className="text-sm text-muted-foreground">Global visibility across users, tenants, and IAM security events.</p>
      </div>

      <form className="rounded-lg border p-4" method="get">
        <label className="text-sm font-medium" htmlFor="q">User search</label>
        <div className="mt-2 flex gap-2">
          <input id="q" name="q" defaultValue={query} className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm" placeholder="Email, phone, or ID" />
          <button className="h-9 rounded-md border border-border px-3 text-sm">Search</button>
        </div>
      </form>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">Users</h2>
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{user.name} · {user.email}</p>
              <p className="text-xs text-muted-foreground">{user.id} · platformRole={user.platformRole} · status={user.status}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {user.memberships.map((membership) => (
                  <span key={membership.id} className="rounded bg-muted px-2 py-1 text-xs">
                    {membership.company.name} ({membership.role})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">Tenants</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{tenant.name}</p>
              <p className="text-xs text-muted-foreground">{tenant.slug} · {tenant.status}</p>
              <p className="text-xs text-muted-foreground">{tenant.primaryDomain || "No primary domain"} · {tenant.domainVerificationStatus}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">Recent IAM audits</h2>
        <div className="space-y-2">
          {audits.map((audit) => (
            <div key={audit.id} className="rounded border p-3 text-xs">
              {new Date(audit.createdAt).toLocaleString()} · {audit.action} · {audit.entityType} ({audit.entityId || "-"}) · actor={audit.actorUserId || "system"} · org={audit.companyId || "global"}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
