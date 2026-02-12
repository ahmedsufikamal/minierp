import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";

describe("session revoke integration", () => {
  const marker = `session-revoke-${Date.now()}`;
  const provider = new LocalIdentityProvider();
  let userId = "";
  let companyId = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";

    const signup = await provider.signUp({
      email: `${marker}@example.com`,
      password: "StrongPassword123!",
      name: "Session Revoke User",
      companyName: `${marker}-company`,
      companySlug: `${marker}-company`,
    });
    const created = await prisma.iamSession.findUnique({
      where: { id: signup.sessionId },
      select: { userId: true, companyId: true },
    });
    if (!created) throw new Error("Failed to initialize session fixture");
    userId = created.userId;
    companyId = created.companyId;

    await provider.signIn({
      email: `${marker}@example.com`,
      password: "StrongPassword123!",
    });
    await provider.signIn({
      email: `${marker}@example.com`,
      password: "StrongPassword123!",
    });
  });

  afterAll(async () => {
    await prisma.iamAuditLog.deleteMany({ where: { actorUserId: userId } });
    await prisma.iamSession.deleteMany({ where: { userId } });
    await prisma.companyMembership.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it("revokes a single session and then revokes all sessions with audit entries", async () => {
    const sessions = await provider.listUserSessions(userId);
    expect(sessions.length).toBeGreaterThan(1);

    await provider.revokeSession(sessions[0]!.id, userId);
    const afterSingle = await provider.listUserSessions(userId);
    expect(afterSingle.length).toBe(sessions.length - 1);

    await provider.revokeAllSessionsForUser(userId, userId);
    const afterAll = await provider.listUserSessions(userId);
    expect(afterAll.length).toBe(0);

    const revokeAudit = await prisma.iamAuditLog.findFirst({
      where: {
        actorUserId: userId,
        action: "SESSION_REVOKED",
      },
    });
    const revokeAllAudit = await prisma.iamAuditLog.findFirst({
      where: {
        actorUserId: userId,
        action: "SESSION_REVOKE_ALL",
      },
    });
    expect(revokeAudit).toBeTruthy();
    expect(revokeAllAudit).toBeTruthy();
  });
});
