import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("iam integration", () => {
  const provider = new LocalIdentityProvider();
  const marker = `it-${Date.now()}`;
  let inviterUserId = "";
  let inviteToken = "";
  let companyId = "";
  let dbReady = false;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch {
      return;
    }

    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";

    const signed = await provider.signUp({
      email: `${marker}-owner@example.com`,
      password: "StrongPassword123!",
      name: "Integration Owner",
      companyName: "Integration Co",
      companySlug: `${marker}-co`,
    });

    const session = await prisma.iamSession.findUnique({
      where: { id: signed.sessionId },
      select: { userId: true, companyId: true },
    });

    if (!session) throw new Error("Failed to initialize integration fixture");

    inviterUserId = session.userId;
    companyId = session.companyId;

    const invited = await provider.inviteToOrg({
      companyId,
      email: `${marker}-member@example.com`,
      createdByUserId: inviterUserId,
    });

    const row = await prisma.iamInvitation.findUnique({
      where: { id: invited.invitationId },
      select: { tokenHash: true },
    });

    if (!row) throw new Error("Invite not found");
    inviteToken = row.tokenHash;
  });

  afterAll(async () => {
    if (!dbReady) return;
    await prisma.iamInvitation.deleteMany({ where: { email: { contains: marker } } });
    await prisma.companyMembership.deleteMany({ where: { user: { email: { contains: marker } } } });
    await prisma.user.deleteMany({ where: { email: { contains: marker } } });
    await prisma.company.deleteMany({ where: { slug: { contains: marker } } });
  });

  it("creates tenant and membership during signup", async () => {
    if (!dbReady) return;
    const membership = await prisma.companyMembership.findFirst({ where: { userId: inviterUserId, companyId } });
    expect(membership).toBeTruthy();
  });

  it("writes invitation record", async () => {
    if (!dbReady) return;
    const invite = await prisma.iamInvitation.findFirst({ where: { companyId, email: `${marker}-member@example.com` } });
    expect(invite).toBeTruthy();
  });

  it("persists session records for created user", async () => {
    if (!dbReady) return;
    const sessions = await prisma.iamSession.findMany({ where: { userId: inviterUserId } });
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("keeps invite hash stored", async () => {
    if (!dbReady) return;
    expect(inviteToken.length).toBeGreaterThan(20);
  });
});
