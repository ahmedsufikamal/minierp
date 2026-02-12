import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { encryptSessionToken } from "@/lib/legacy-session-token";
import { hasPermission } from "@/modules/iam/application/rbac";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import { resolvePrincipalFromTokens } from "@/modules/iam/application/principal-resolver";
import { bridgeLegacyPrincipalToIamSession } from "@/modules/iam/application/session-bridge";

describe("org auth bridge integration", () => {
  const marker = `org-bridge-${Date.now()}`;
  let companyId = "";
  let ownerUserId = "";
  let viewerUserId = "";
  let ownerLegacyToken = "";
  let viewerLegacyToken = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    process.env.JWT_SECRET ||= "integration_jwt_secret_12345678901234567890";
    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";
    process.env.IAM_LEGACY_FALLBACK_ENABLED = "1";

    const company = await prisma.company.create({
      data: {
        name: `Bridge Co ${marker}`,
        slug: `${marker}-co`,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    companyId = company.id;

    await ensureDefaultTenantRoles(companyId);

    const [owner, viewer] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${marker}-owner@example.com`,
          passwordHash: "integration-hash",
          name: "Bridge Owner",
          role: "USER",
          status: "ACTIVE",
          companyId,
          activeCompanyId: companyId,
        },
        select: { id: true, email: true, name: true },
      }),
      prisma.user.create({
        data: {
          email: `${marker}-viewer@example.com`,
          passwordHash: "integration-hash",
          name: "Bridge Viewer",
          role: "USER",
          status: "ACTIVE",
          companyId,
          activeCompanyId: companyId,
        },
        select: { id: true, email: true, name: true },
      }),
    ]);

    ownerUserId = owner.id;
    viewerUserId = viewer.id;

    await prisma.companyMembership.createMany({
      data: [
        {
          userId: owner.id,
          companyId,
          role: "OWNER",
          status: "ACTIVE",
          isDefault: true,
          joinedAt: new Date(),
        },
        {
          userId: viewer.id,
          companyId,
          role: "VIEWER",
          status: "ACTIVE",
          isDefault: true,
          joinedAt: new Date(),
        },
      ],
    });

    ownerLegacyToken = await encryptSessionToken({
      userId: owner.id,
      companyId,
      email: owner.email,
      name: owner.name,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    viewerLegacyToken = await encryptSessionToken({
      userId: viewer.id,
      companyId,
      email: viewer.email,
      name: viewer.name,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    await prisma.iamSession.deleteMany({ where: { userId: { in: [ownerUserId, viewerUserId] } } });
    await prisma.companyMembership.deleteMany({ where: { userId: { in: [ownerUserId, viewerUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, viewerUserId] } } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it("resolves legacy owner principal and grants org settings permission", async () => {
    const resolved = await resolvePrincipalFromTokens(
      {
        legacySessionToken: ownerLegacyToken,
      },
      { allowLegacyFallback: true },
    );

    expect(resolved.source).toBe("legacy");
    expect(resolved.principal?.membershipRole).toBe("OWNER");

    const allowed = await hasPermission(
      resolved.principal!.userId,
      resolved.principal!.activeCompanyId,
      "admin.settings",
    );
    expect(allowed).toBe(true);
  });

  it("bridges a legacy principal into a persisted IAM session", async () => {
    const resolved = await resolvePrincipalFromTokens(
      {
        legacySessionToken: ownerLegacyToken,
      },
      { allowLegacyFallback: true },
    );

    expect(resolved.principal).toBeTruthy();

    const bridged = await bridgeLegacyPrincipalToIamSession({
      principal: resolved.principal!,
      ip: "127.0.0.1",
      userAgent: "vitest",
      requestId: "test-bridge",
    });

    const session = await prisma.iamSession.findUnique({
      where: { id: bridged.sessionId },
      select: { userId: true, companyId: true },
    });

    expect(session?.userId).toBe(ownerUserId);
    expect(session?.companyId).toBe(companyId);
  });

  it("keeps viewer blocked from org settings permission", async () => {
    const resolved = await resolvePrincipalFromTokens(
      {
        legacySessionToken: viewerLegacyToken,
      },
      { allowLegacyFallback: true },
    );

    expect(resolved.source).toBe("legacy");
    expect(resolved.principal?.membershipRole).toBe("VIEWER");

    const allowed = await hasPermission(
      resolved.principal!.userId,
      resolved.principal!.activeCompanyId,
      "admin.settings",
    );
    expect(allowed).toBe(false);
  });
});
