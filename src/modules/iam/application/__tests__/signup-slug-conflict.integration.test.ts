import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

describe("signup slug conflict integration", () => {
  const provider = new LocalIdentityProvider();
  const marker = `it-slug-${Date.now()}`;
  const slug = `${marker}-company`;
  const firstEmail = `${marker}-owner@example.com`;
  const secondEmail = `${marker}-member@example.com`;

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";
  });

  afterAll(async () => {
    await prisma.iamInvitation.deleteMany({ where: { email: { contains: marker } } });
    await prisma.companyMembership.deleteMany({ where: { user: { email: { contains: marker } } } });
    await prisma.user.deleteMany({ where: { email: { contains: marker } } });
    await prisma.company.deleteMany({ where: { slug: { contains: marker } } });
  });

  it("throws CONFLICT when signup attempts to reuse an existing company slug", async () => {
    const first = await provider.signUp({
      email: firstEmail,
      password: "StrongPassword123!",
      name: "First User",
      companyName: "Slug Conflict Co",
      companySlug: slug,
    });
    expect(first.sessionId).toBeTruthy();

    let captured: unknown;
    try {
      await provider.signUp({
        email: secondEmail,
        password: "StrongPassword123!",
        name: "Second User",
        companyName: "Slug Conflict Co 2",
        companySlug: slug,
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(IamError);
    expect((captured as IamError).code).toBe("CONFLICT");
    expect((captured as IamError).message).toBe("Organization slug already exists");

    const createdUsers = await prisma.user.count({
      where: {
        email: {
          in: [firstEmail, secondEmail],
        },
      },
    });
    expect(createdUsers).toBe(1);
  });
});
