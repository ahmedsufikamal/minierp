import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

describe("verified-domain auto-join integration", () => {
  const marker = `autojoin-${Date.now()}`;
  const provider = new LocalIdentityProvider();
  let targetCompanyId = "";
  let pendingUserId = "";
  let verifiedUserId = "";
  let pendingSessionId = "";
  let verifiedSessionId = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";

    const company = await prisma.company.create({
      data: {
        name: `${marker}-company`,
        slug: `${marker}-company`,
        status: "ACTIVE",
        domainVerificationStatus: "PENDING",
      },
      select: { id: true },
    });
    targetCompanyId = company.id;
    await ensureDefaultTenantRoles(targetCompanyId);

    await prisma.iamAutoJoinRule.create({
      data: {
        companyId: targetCompanyId,
        ruleType: "VERIFIED_DOMAIN",
        config: { domains: ["example.com"] },
        isEnabled: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.iamSession.deleteMany({ where: { id: { in: [pendingSessionId, verifiedSessionId] } } });
    await prisma.companyMembership.deleteMany({ where: { userId: { in: [pendingUserId, verifiedUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pendingUserId, verifiedUserId] } } });
    await prisma.iamAutoJoinRule.deleteMany({ where: { companyId: targetCompanyId } });
    await prisma.company.deleteMany({ where: { id: targetCompanyId } });
    await prisma.company.deleteMany({ where: { slug: { contains: `${marker}-fallback` } } });
  });

  it("does not auto-join when company domain verification is pending", async () => {
    const signed = await provider.signUp({
      email: `${marker}-pending@example.com`,
      password: "StrongPassword123!",
      name: "Pending Domain User",
      companyName: `${marker} fallback pending`,
      companySlug: `${marker}-fallback-pending`,
    });
    pendingSessionId = signed.sessionId;
    const session = await prisma.iamSession.findUnique({
      where: { id: signed.sessionId },
      select: { userId: true, companyId: true },
    });
    if (!session) throw new Error("Missing pending-domain session");
    pendingUserId = session.userId;
    expect(session.companyId).not.toBe(targetCompanyId);
  });

  it("auto-joins once company domain is verified", async () => {
    await prisma.company.update({
      where: { id: targetCompanyId },
      data: { domainVerificationStatus: "VERIFIED" },
    });

    const signed = await provider.signUp({
      email: `${marker}-verified@example.com`,
      password: "StrongPassword123!",
      name: "Verified Domain User",
      companyName: `${marker} fallback verified`,
      companySlug: `${marker}-fallback-verified`,
    });
    verifiedSessionId = signed.sessionId;
    const session = await prisma.iamSession.findUnique({
      where: { id: signed.sessionId },
      select: { userId: true, companyId: true },
    });
    if (!session) throw new Error("Missing verified-domain session");
    verifiedUserId = session.userId;
    expect(session.companyId).toBe(targetCompanyId);

    const membership = await prisma.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: session.userId,
          companyId: targetCompanyId,
        },
      },
      select: { role: true, status: true },
    });
    expect(membership?.status).toBe("ACTIVE");
    expect(membership?.role).toBe("MEMBER");
  });
});
