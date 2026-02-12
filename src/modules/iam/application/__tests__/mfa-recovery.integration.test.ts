import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

describe("mfa recovery integration", () => {
  const provider = new LocalIdentityProvider();
  const marker = `mfa-recovery-${Date.now()}`;
  let userId = "";
  let companyId = "";
  let recoveryCode = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";

    const signed = await provider.signUp({
      email: `${marker}@example.com`,
      password: "StrongPassword123!",
      name: "Recovery User",
      companyName: `${marker}-company`,
      companySlug: `${marker}-company`,
    });
    const session = await prisma.iamSession.findUnique({
      where: { id: signed.sessionId },
      select: { userId: true, companyId: true },
    });
    if (!session) {
      throw new Error("Failed to initialize recovery fixture");
    }

    userId = session.userId;
    companyId = session.companyId;

    const enrolled = await provider.enrollMfa({
      userId,
      label: "Integration MFA",
    });
    recoveryCode = enrolled.recoveryCodes[0]!;
  });

  afterAll(async () => {
    await prisma.iamRecoveryCode.deleteMany({ where: { userId } });
    await prisma.iamMfaFactor.deleteMany({ where: { userId } });
    await prisma.iamSession.deleteMany({ where: { userId } });
    await prisma.companyMembership.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it("accepts valid recovery code once", async () => {
    const result = await provider.verifyRecoveryCode({ userId, code: recoveryCode });
    expect(result.ok).toBe(true);

    const usedCount = await prisma.iamRecoveryCode.count({
      where: { userId, usedAt: { not: null } },
    });
    expect(usedCount).toBeGreaterThan(0);
  });

  it("rejects reused recovery code", async () => {
    await expect(
      provider.verifyRecoveryCode({
        userId,
        code: recoveryCode,
      }),
    ).rejects.toMatchObject({ code: "RECOVERY_CODE_USED" });
  });

  it("rejects unknown recovery code", async () => {
    await expect(
      provider.verifyRecoveryCode({
        userId,
        code: "NOT-A-VALID-CODE",
      }),
    ).rejects.toMatchObject({ code: "RECOVERY_CODE_INVALID" });
  });
});
