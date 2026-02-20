import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import { transferMasterAdmin } from "@/modules/iam/application/master-admin";
import { updateUserPlatformRole } from "@/modules/iam/application/platform-admin";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

describe("master admin governance integration", () => {
  const marker = `master-admin-${Date.now()}`;
  const provider = new LocalIdentityProvider();
  let companyId = "";
  let actorUserId = "";
  let ownerUserId = "";
  let memberUserId = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";
    process.env.IAM_MASTER_ADMIN_ENFORCEMENT = "1";
    process.env.IAM_PLATFORM_ROLE_MANAGEMENT = "1";

    const company = await prisma.company.create({
      data: {
        name: `${marker} Co`,
        slug: `${marker}-co`,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    companyId = company.id;
    await ensureDefaultTenantRoles(companyId);

    const [ownerRole, adminRole] = await Promise.all([
      prisma.iamRole.findUnique({
        where: { companyId_name: { companyId, name: "OWNER" } },
        select: { id: true },
      }),
      prisma.iamRole.findUnique({
        where: { companyId_name: { companyId, name: "ADMIN" } },
        select: { id: true },
      }),
    ]);
    if (!ownerRole?.id || !adminRole?.id) {
      throw new Error("Failed to bootstrap owner/admin roles for integration fixture");
    }

    const [actor, owner, member] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${marker}-actor@example.com`,
          passwordHash: "hashed-password",
          name: "Actor User",
          companyId,
          activeCompanyId: companyId,
          role: "ADMIN",
          status: "ACTIVE",
          platformRole: "SUPER_ADMIN",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `${marker}-owner@example.com`,
          passwordHash: "hashed-password",
          name: "Owner User",
          companyId,
          activeCompanyId: companyId,
          role: "OWNER",
          status: "ACTIVE",
          platformRole: "NONE",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `${marker}-member@example.com`,
          passwordHash: "hashed-password",
          name: "Member User",
          companyId,
          activeCompanyId: companyId,
          role: "ADMIN",
          status: "ACTIVE",
          platformRole: "NONE",
        },
        select: { id: true },
      }),
    ]);

    actorUserId = actor.id;
    ownerUserId = owner.id;
    memberUserId = member.id;

    await prisma.companyMembership.createMany({
      data: [
        {
          userId: ownerUserId,
          companyId,
          role: "OWNER",
          roleId: ownerRole.id,
          status: "ACTIVE",
          isDefault: true,
          joinedAt: new Date(),
        },
        {
          userId: memberUserId,
          companyId,
          role: "ADMIN",
          roleId: adminRole.id,
          status: "ACTIVE",
          isDefault: false,
          joinedAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.iamAuditLog.deleteMany({
      where: { companyId },
    });
    if (actorUserId) {
      await prisma.iamAuditLog.deleteMany({
        where: { actorUserId },
      });
    }
    await prisma.companyMembership.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { email: { contains: marker } } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it("enforces demotion guard when actor is the last active super admin", async () => {
    const activeSuperAdminCount = await prisma.user.count({
      where: {
        platformRole: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });

    if (activeSuperAdminCount <= 1) {
      await expect(
        updateUserPlatformRole({
          actorUserId,
          targetUserId: actorUserId,
          nextRole: "NONE",
        }),
      ).rejects.toThrow(/last active Super Admin/i);
      return;
    }

    const result = await updateUserPlatformRole({
      actorUserId,
      targetUserId: actorUserId,
      nextRole: "NONE",
    });
    expect(result.platformRole).toBe("NONE");
  });

  it("allows demotion once another super admin exists", async () => {
    await updateUserPlatformRole({
      actorUserId,
      targetUserId: memberUserId,
      nextRole: "SUPER_ADMIN",
    });
    await updateUserPlatformRole({
      actorUserId,
      targetUserId: actorUserId,
      nextRole: "NONE",
    });

    const [actor, member] = await Promise.all([
      prisma.user.findUnique({ where: { id: actorUserId }, select: { platformRole: true } }),
      prisma.user.findUnique({ where: { id: memberUserId }, select: { platformRole: true } }),
    ]);
    expect(actor?.platformRole).toBe("NONE");
    expect(member?.platformRole).toBe("SUPER_ADMIN");
  });

  it("transfers master admin to another active member", async () => {
    const result = await transferMasterAdmin({
      companyId,
      actorUserId: memberUserId,
      nextOwnerUserId: memberUserId,
    });
    expect(result.previousOwnerUserId).toBe(ownerUserId);
    expect(result.nextOwnerUserId).toBe(memberUserId);

    const [previousOwnerMembership, nextOwnerMembership] = await Promise.all([
      prisma.companyMembership.findUnique({
        where: { userId_companyId: { userId: ownerUserId, companyId } },
        select: { role: true, status: true },
      }),
      prisma.companyMembership.findUnique({
        where: { userId_companyId: { userId: memberUserId, companyId } },
        select: { role: true, status: true },
      }),
    ]);
    expect(previousOwnerMembership?.role).toBe("ADMIN");
    expect(previousOwnerMembership?.status).toBe("ACTIVE");
    expect(nextOwnerMembership?.role).toBe("OWNER");
    expect(nextOwnerMembership?.status).toBe("ACTIVE");
  });

  it("blocks direct reassignment to owner through setRole", async () => {
    const ownerRole = await prisma.iamRole.findUnique({
      where: { companyId_name: { companyId, name: "OWNER" } },
      select: { id: true },
    });
    if (!ownerRole?.id) throw new Error("Missing owner role");

    await expect(
      provider.setRole({
        companyId,
        userId: ownerUserId,
        roleId: ownerRole.id,
      }),
    ).rejects.toThrow(/master-admin transfer/i);
  });
});
