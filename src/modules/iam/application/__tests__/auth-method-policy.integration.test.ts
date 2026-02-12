import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

describe("auth method policy integration", () => {
  const provider = new LocalIdentityProvider();
  const marker = `auth-policy-${Date.now()}`;
  let userId = "";
  let companyId = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";

    const signed = await provider.signUp({
      email: `${marker}@example.com`,
      password: "StrongPassword123!",
      name: "Auth Policy User",
      companyName: `${marker}-company`,
      companySlug: `${marker}-company`,
    });

    const session = await prisma.iamSession.findUnique({
      where: { id: signed.sessionId },
      select: { userId: true, companyId: true },
    });
    if (!session) {
      throw new Error("Failed to initialize auth policy fixture");
    }

    userId = session.userId;
    companyId = session.companyId;
  });

  afterAll(async () => {
    await prisma.iamSession.deleteMany({ where: { user: { email: { contains: marker } } } });
    await prisma.companyMembership.deleteMany({ where: { user: { email: { contains: marker } } } });
    await prisma.user.deleteMany({ where: { email: { contains: marker } } });
    await prisma.company.deleteMany({ where: { slug: { contains: marker } } });
  });

  it("blocks password sign-in when PASSWORD method is disabled for tenant", async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        allowedAuthMethods: ["MAGIC_LINK"],
      },
    });

    await expect(
      provider.signIn({
        email: `${marker}@example.com`,
        password: "StrongPassword123!",
      }),
    ).rejects.toMatchObject({ code: "AUTH_METHOD_DISABLED" });
  });

  it("blocks magic-link send when MAGIC_LINK is disabled for tenant", async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        allowedAuthMethods: ["PASSWORD"],
      },
    });

    await expect(
      provider.sendMagicLink({
        email: `${marker}@example.com`,
      }),
    ).rejects.toMatchObject({ code: "AUTH_METHOD_DISABLED" });
  });

  it("allows password sign-in again after re-enabling PASSWORD", async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        allowedAuthMethods: ["PASSWORD", "MAGIC_LINK"],
      },
    });

    const result = await provider.signIn({
      email: `${marker}@example.com`,
      password: "StrongPassword123!",
    });
    expect(result.sessionId).toBeTruthy();

    await prisma.iamSession.deleteMany({ where: { userId } });
  });
});
