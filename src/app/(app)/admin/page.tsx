import { prisma } from "@/lib/prisma";
import { getIdentityProvider, requirePlatformAdmin, requireStepUp } from "@/modules/iam";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function PlatformAdminPage(props: PageProps) {
  const admin = await requirePlatformAdmin();
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
  const disableTenantAction = async (formData: FormData) => {
    "use server";
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const companyId = String(formData.get("companyId") || "");
    if (!companyId) return;

    await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data: { status: "DISABLED", isActive: false },
      }),
      prisma.iamSession.updateMany({
        where: { companyId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "SECURITY_EVENT" },
      }),
    ]);
    await writeIamAudit({
      action: "TENANT_DISABLED",
      companyId,
      actorUserId: principal.userId,
      entityType: "Company",
      entityId: companyId,
    });
    revalidatePath("/admin");
  };
  const forceLogoutTenantAction = async (formData: FormData) => {
    "use server";
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const companyId = String(formData.get("companyId") || "");
    if (!companyId) return;
    const result = await prisma.iamSession.updateMany({
      where: { companyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "ADMIN_REVOKE" },
    });
    await writeIamAudit({
      action: "SESSION_REVOKE_ALL",
      companyId,
      actorUserId: principal.userId,
      entityType: "Company",
      entityId: companyId,
      metadata: { revokedCount: result.count },
    });
    revalidatePath("/admin");
  };
  const forceMfaTenantAction = async (formData: FormData) => {
    "use server";
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const companyId = String(formData.get("companyId") || "");
    if (!companyId) return;
    await prisma.company.update({
      where: { id: companyId },
      data: {
        mfaPolicy: {
          mode: "REQUIRED_FOR_ALL",
          enforceForRoles: ["OWNER", "ADMIN"],
          allowOtpFallback: false,
        },
      },
    });
    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId,
      actorUserId: principal.userId,
      entityType: "Company",
      entityId: companyId,
      metadata: { forcedMfa: true },
    });
    revalidatePath("/admin");
  };
  const startImpersonationAction = async (formData: FormData) => {
    "use server";
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const targetUserId = String(formData.get("targetUserId") || "");
    const targetCompanyId = String(formData.get("targetCompanyId") || "");
    const reason = String(formData.get("reason") || "").trim();
    if (!targetUserId || !targetCompanyId || reason.length < 8) return;

    await getIdentityProvider().startImpersonation({
      actorUserId: principal.userId,
      targetUserId,
      targetCompanyId,
      reason,
    });
    revalidatePath("/admin");
  };
  const forcePasswordResetAction = async (formData: FormData) => {
    "use server";
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const userId = String(formData.get("userId") || "");
    const reason = String(formData.get("reason") || "").trim();
    if (!userId || reason.length < 4) return;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, activeCompanyId: true },
    });
    if (!target) return;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { mustResetPassword: true },
      }),
      prisma.iamSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "SECURITY_EVENT" },
      }),
    ]);
    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: target.activeCompanyId ?? null,
      actorUserId: principal.userId,
      entityType: "User",
      entityId: userId,
      metadata: { forcedPasswordReset: true, reason },
    });
    revalidatePath("/admin");
  };

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
              <p className="text-xs text-muted-foreground">
                {user.id} · platformRole={user.platformRole} · status={user.status} · mustResetPassword={user.mustResetPassword ? "yes" : "no"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {user.memberships.map((membership) => (
                  <span key={membership.id} className="rounded bg-muted px-2 py-1 text-xs">
                    {membership.company.name} ({membership.role})
                  </span>
                ))}
              </div>
              <form action={forcePasswordResetAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <input
                  name="reason"
                  placeholder="Reason for forced password reset"
                  className="h-8 min-w-[240px] rounded border border-border bg-transparent px-2 text-xs"
                  required
                />
                <button className="rounded border px-2 py-1 text-xs">Force password reset</button>
              </form>
              {admin.platformRole === "SUPER_ADMIN" && user.memberships[0] ? (
                <form action={startImpersonationAction} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="targetUserId" value={user.id} />
                  <input type="hidden" name="targetCompanyId" value={user.memberships[0].company.id} />
                  <input
                    name="reason"
                    placeholder="Reason for impersonation"
                    className="h-8 min-w-[240px] rounded border border-border bg-transparent px-2 text-xs"
                    required
                  />
                  <button className="rounded border px-2 py-1 text-xs">Impersonate</button>
                </form>
              ) : null}
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
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={disableTenantAction}>
                  <input type="hidden" name="companyId" value={tenant.id} />
                  <button className="rounded border px-2 py-1 text-xs">Disable tenant</button>
                </form>
                <form action={forceLogoutTenantAction}>
                  <input type="hidden" name="companyId" value={tenant.id} />
                  <button className="rounded border px-2 py-1 text-xs">Force logout</button>
                </form>
                <form action={forceMfaTenantAction}>
                  <input type="hidden" name="companyId" value={tenant.id} />
                  <button className="rounded border px-2 py-1 text-xs">Force MFA</button>
                </form>
              </div>
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
