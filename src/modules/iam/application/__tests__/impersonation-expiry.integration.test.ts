import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import { createSessionRecord, verifySessionToken } from "@/modules/iam/infrastructure/session";

describe("impersonation expiry integration", () => {
  const marker = `imp-exp-${Date.now()}`;
  let companyId = "";
  let actorUserId = "";
  let targetUserId = "";
  let token = "";
  let sessionId = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";

    const company = await prisma.company.create({
      data: {
        name: `${marker}-company`,
        slug: `${marker}-company`,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    companyId = company.id;
    await ensureDefaultTenantRoles(companyId);

    const [actor, target] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${marker}-actor@example.com`,
          passwordHash: "integration",
          name: "Impersonation Actor",
          platformRole: "SUPER_ADMIN",
          role: "ADMIN",
          companyId,
          activeCompanyId: companyId,
          status: "ACTIVE",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `${marker}-target@example.com`,
          passwordHash: "integration",
          name: "Impersonation Target",
          role: "MEMBER",
          companyId,
          activeCompanyId: companyId,
          status: "ACTIVE",
        },
        select: { id: true },
      }),
    ]);
    actorUserId = actor.id;
    targetUserId = target.id;

    await prisma.companyMembership.createMany({
      data: [
        {
          userId: actor.id,
          companyId,
          role: "OWNER",
          status: "ACTIVE",
          isDefault: true,
          joinedAt: new Date(),
        },
        {
          userId: target.id,
          companyId,
          role: "MEMBER",
          status: "ACTIVE",
          isDefault: true,
          joinedAt: new Date(),
        },
      ],
    });

    const created = await createSessionRecord({
      userId: target.id,
      companyId,
      rememberMe: false,
      ip: "127.0.0.1",
      userAgent: "vitest",
    });
    token = created.token;
    sessionId = created.sessionId;

    await prisma.iamSession.update({
      where: { id: sessionId },
      data: { impersonatorUserId: actor.id },
    });

    await prisma.iamImpersonationSession.create({
      data: {
        sessionId,
        actorUserId: actor.id,
        targetUserId: target.id,
        targetCompanyId: companyId,
        reason: "Integration test",
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await prisma.iamAuditLog.deleteMany({ where: { entityId: sessionId } });
    await prisma.iamImpersonationSession.deleteMany({ where: { sessionId } });
    await prisma.iamSession.deleteMany({ where: { id: sessionId } });
    await prisma.companyMembership.deleteMany({ where: { userId: { in: [actorUserId, targetUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [actorUserId, targetUserId] } } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it("marks impersonation as ended on expiry and emits IMPERSONATION_ENDED audit", async () => {
    const principal = await verifySessionToken(token);
    expect(principal).toBeNull();

    const ended = await prisma.iamImpersonationSession.findUnique({
      where: { sessionId },
      select: { endedAt: true },
    });
    expect(ended?.endedAt).not.toBeNull();

    const audit = await prisma.iamAuditLog.findFirst({
      where: {
        action: "IMPERSONATION_ENDED",
        entityId: sessionId,
      },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });
    expect(audit).toBeTruthy();
    expect((audit?.metadata as { reason?: string } | null)?.reason).toBe("EXPIRED");
  });
});
