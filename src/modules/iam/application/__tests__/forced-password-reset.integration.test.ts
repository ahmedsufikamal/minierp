import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

describe("forced password reset integration", () => {
  const marker = `forced-reset-${Date.now()}`;
  const provider = new LocalIdentityProvider();
  let userId = "";
  let companyId = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";

    const signed = await provider.signUp({
      email: `${marker}@example.com`,
      password: "StrongPassword123!",
      name: "Forced Reset User",
      companyName: `${marker}-company`,
      companySlug: `${marker}-company`,
    });
    const session = await prisma.iamSession.findUnique({
      where: { id: signed.sessionId },
      select: { userId: true, companyId: true },
    });
    if (!session) {
      throw new Error("Failed to initialize forced-reset fixture");
    }
    userId = session.userId;
    companyId = session.companyId;

    await prisma.user.update({
      where: { id: userId },
      data: { mustResetPassword: true },
    });
  });

  afterAll(async () => {
    await prisma.iamSession.deleteMany({ where: { userId } });
    await prisma.companyMembership.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it("blocks sign-in with PASSWORD_RESET_REQUIRED while forced reset is enabled", async () => {
    await expect(
      provider.signIn({
        email: `${marker}@example.com`,
        password: "StrongPassword123!",
      }),
    ).rejects.toMatchObject({ code: "PASSWORD_RESET_REQUIRED" });
  });

  it("allows sign-in again after forced-reset flag is cleared", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { mustResetPassword: false },
    });

    const result = await provider.signIn({
      email: `${marker}@example.com`,
      password: "StrongPassword123!",
    });
    expect(result.sessionId).toBeTruthy();
  });
});
