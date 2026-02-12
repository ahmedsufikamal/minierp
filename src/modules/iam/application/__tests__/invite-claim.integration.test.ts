import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import { hashToken } from "@/modules/iam/infrastructure/crypto";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

describe("invite claim integration", () => {
  const marker = `invite-${Date.now()}`;
  const provider = new LocalIdentityProvider();
  const token = `token-${marker}`;
  let companyId = "";
  let invitationId = "";
  let userId = "";

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

    const memberRole = await prisma.iamRole.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: "MEMBER",
        },
      },
      select: { id: true },
    });

    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.com`,
        passwordHash: "test-password",
        name: "Invited User",
        role: "USER",
        companyId,
        activeCompanyId: companyId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    userId = user.id;

    const invitation = await prisma.iamInvitation.create({
      data: {
        companyId,
        email: `${marker}@example.com`,
        roleId: memberRole?.id ?? null,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      select: { id: true },
    });
    invitationId = invitation.id;
  });

  afterAll(async () => {
    await prisma.iamInvitation.deleteMany({ where: { id: invitationId } });
    await prisma.companyMembership.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it("previews invite token metadata", async () => {
    const invite = await provider.previewInvite(token);
    expect(invite.companyId).toBe(companyId);
    expect(invite.email).toBe(`${marker}@example.com`);
  });

  it("rejects claim when email mismatches", async () => {
    await expect(
      provider.claimInvite({
        token,
        userId,
        userEmail: "wrong@example.com",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_EMAIL_MISMATCH" });
  });

  it("claims invite and activates membership when email matches", async () => {
    await provider.claimInvite({
      token,
      userId,
      userEmail: `${marker}@example.com`,
    });

    const membership = await prisma.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
      select: { status: true, role: true },
    });
    expect(membership?.status).toBe("ACTIVE");
    expect(membership?.role).toBe("MEMBER");

    const invite = await prisma.iamInvitation.findUnique({
      where: { id: invitationId },
      select: { acceptedAt: true },
    });
    expect(invite?.acceptedAt).not.toBeNull();
  });
});
