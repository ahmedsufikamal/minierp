import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createJournalEntryDraft, submitJournalEntry } from "@/modules/accounting/application/gl-posting.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";
import { createSessionRecord } from "@/modules/iam/infrastructure/session";
import { POST as createJournalEntryRoute } from "@/app/api/v1/accounting/journal-entries/route";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("accounting wave1 integration", () => {
  const marker = `acct-wave1-${Date.now()}`;
  const provider = new LocalIdentityProvider();

  let ownerUserId = "";
  let memberUserId = "";
  let companyId = "";
  let tenantId = "";
  let memberSessionToken = "";

  let openPostingDate: Date;
  let closedPostingDate: Date;

  let debitAccountId = "";
  let creditAccountId = "";

  let ownerCtx: PlatformRequestContext;

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.IAM_TOKEN_HASH_SECRET ||= "integration_hash_secret_12345678901234567890";
    process.env.IAM_ENCRYPTION_SECRET ||= "integration_encrypt_secret_12345678901234567890";

    const signed = await provider.signUp({
      email: `${marker}-owner@example.com`,
      password: "StrongPassword123!",
      name: "Accounting Owner",
      companyName: `${marker}-company`,
      companySlug: `${marker}-company`,
    });

    const ownerSession = await prisma.iamSession.findUnique({
      where: { id: signed.sessionId },
      select: { userId: true, companyId: true },
    });
    if (!ownerSession) {
      throw new Error("Failed to resolve owner session");
    }

    ownerUserId = ownerSession.userId;
    companyId = ownerSession.companyId;

    const tenant = await prisma.tenant.create({
      data: {
        key: `${marker}-tenant`,
        name: "Accounting Integration Tenant",
        status: "ACTIVE",
        plan: "community",
      },
    });
    tenantId = tenant.id;

    await prisma.company.update({
      where: { id: companyId },
      data: { tenantId },
    });

    const memberRole = await prisma.iamRole.findUnique({
      where: { companyId_name: { companyId, name: "MEMBER" } },
      select: { id: true },
    });
    if (!memberRole) {
      throw new Error("Failed to resolve MEMBER role");
    }

    const memberPasswordHash = await bcrypt.hash("StrongPassword123!", 10);
    const memberUser = await prisma.user.create({
      data: {
        email: `${marker}-member@example.com`,
        passwordHash: memberPasswordHash,
        name: "Accounting Member",
        role: "MEMBER",
        companyId,
        activeCompanyId: companyId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    memberUserId = memberUser.id;

    await prisma.companyMembership.create({
      data: {
        userId: memberUserId,
        companyId,
        role: "MEMBER",
        roleId: memberRole.id,
        status: "ACTIVE",
        isDefault: false,
        joinedAt: new Date(),
      },
    });

    const memberSession = await createSessionRecord({
      userId: memberUserId,
      companyId,
      rememberMe: false,
    });
    memberSessionToken = memberSession.token;

    await prisma.numberSeries.upsert({
      where: {
        tenantId_companyId_key: {
          tenantId,
          companyId,
          key: "JE",
        },
      },
      create: {
        tenantId,
        companyId,
        key: "JE",
        name: "Integration Journal Series",
        pattern: "JE-{FY}-{####}",
        resetPolicy: "FISCAL_YEAR",
        startAt: 1,
        padding: 4,
        isActive: true,
      },
      update: {
        name: "Integration Journal Series",
        pattern: "JE-{FY}-{####}",
        resetPolicy: "FISCAL_YEAR",
        startAt: 1,
        padding: 4,
        isActive: true,
      },
    });

    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        tenantId,
        companyId,
        name: "FY26-INT",
        startDate: new Date(Date.UTC(2026, 0, 1)),
        endDate: new Date(Date.UTC(2026, 11, 31)),
        isClosed: false,
        isDefault: true,
        createdBy: ownerUserId,
      },
    });

    const janPeriod = await prisma.accountingPeriod.create({
      data: {
        tenantId,
        companyId,
        fiscalYearId: fiscalYear.id,
        name: "FY26-INT-01",
        startDate: new Date(Date.UTC(2026, 0, 1)),
        endDate: new Date(Date.UTC(2026, 0, 31)),
        status: "OPEN",
        isYearEnd: false,
      },
    });
    await prisma.accountingPeriod.create({
      data: {
        tenantId,
        companyId,
        fiscalYearId: fiscalYear.id,
        name: "FY26-INT-02",
        startDate: new Date(Date.UTC(2026, 1, 1)),
        endDate: new Date(Date.UTC(2026, 1, 28)),
        status: "CLOSED",
        isYearEnd: false,
        closedAt: new Date(),
        closedBy: ownerUserId,
      },
    });

    const debitAccount = await prisma.account.create({
      data: {
        tenantId,
        companyId,
        code: `1100-${marker}`,
        name: "Integration Cash",
        type: "ASSET",
        rootType: "ASSET",
        isGroup: false,
      },
      select: { id: true },
    });
    debitAccountId = debitAccount.id;

    const creditAccount = await prisma.account.create({
      data: {
        tenantId,
        companyId,
        code: `4100-${marker}`,
        name: "Integration Sales",
        type: "INCOME",
        rootType: "INCOME",
        isGroup: false,
      },
      select: { id: true },
    });
    creditAccountId = creditAccount.id;

    openPostingDate = new Date(Date.UTC(2026, 0, 15));
    closedPostingDate = new Date(Date.UTC(2026, 1, 15));

    ownerCtx = {
      requestId: `${marker}-owner-context`,
      tenantId,
      companyId,
      userId: ownerUserId,
      role: "OWNER",
      platformRole: "NONE",
      permissions: [],
    };

    expect(janPeriod.status).toBe("OPEN");
  });

  afterAll(async () => {
    if (!companyId) return;

    await prisma.outboxEvent.deleteMany({ where: { companyId } });
    await prisma.immutableLedgerEvent.deleteMany({ where: { companyId } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });
    await prisma.gLEntry.deleteMany({ where: { companyId } });
    await prisma.journalLine.deleteMany({ where: { entry: { companyId } } });
    await prisma.journalEntry.deleteMany({ where: { companyId } });
    await prisma.accountingPeriod.deleteMany({ where: { companyId } });
    await prisma.fiscalYear.deleteMany({ where: { companyId } });
    await prisma.account.deleteMany({ where: { companyId } });
    await prisma.numberSeriesCounter.deleteMany({ where: { series: { companyId } } });
    await prisma.numberSeries.deleteMany({ where: { companyId } });

    await prisma.iamAuditLog.deleteMany({ where: { companyId } });
    await prisma.iamSession.deleteMany({ where: { companyId } });
    await prisma.companyMembership.deleteMany({ where: { companyId } });
    await prisma.iamRolePermission.deleteMany({ where: { role: { companyId } } });
    await prisma.iamRole.deleteMany({ where: { companyId } });

    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { email: { contains: marker } } });
    if (tenantId) {
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("submits a balanced journal entry and writes GL + platform events", async () => {
    const draft = await createJournalEntryDraft(ownerCtx, {
      date: openPostingDate,
      postingDate: openPostingDate,
      memo: "Integration open period posting",
      lines: [
        {
          accountId: debitAccountId,
          debitCents: 12500,
          creditCents: 0,
          description: "Debit cash",
        },
        {
          accountId: creditAccountId,
          debitCents: 0,
          creditCents: 12500,
          description: "Credit sales",
        },
      ],
    });

    const posted = await submitJournalEntry(ownerCtx, {
      journalEntryId: draft.id,
      postingDate: openPostingDate,
    });

    expect(posted.status).toBe("SUBMITTED");
    expect(posted.number).toContain("JE-FY26-INT-");

    const glRows = await prisma.gLEntry.findMany({
      where: { companyId, journalEntryId: posted.id },
    });
    expect(glRows).toHaveLength(2);

    const immutableRows = await prisma.immutableLedgerEvent.findMany({
      where: {
        companyId,
        stream: "accounting",
        entityType: "JournalEntry",
        entityId: posted.id,
      },
    });
    expect(immutableRows.length).toBeGreaterThan(0);

    const auditRows = await prisma.auditEvent.findMany({
      where: {
        companyId,
        entityType: "JournalEntry",
        entityId: posted.id,
        action: "journal_entry.submitted",
      },
    });
    expect(auditRows.length).toBeGreaterThan(0);

    const outboxRows = await prisma.outboxEvent.findMany({
      where: {
        companyId,
        aggregateType: "JournalEntry",
        aggregateId: posted.id,
        topic: "accounting.journal_entry.submitted",
      },
    });
    expect(outboxRows.length).toBeGreaterThan(0);
  });

  it("rejects journal submit when posting date belongs to a closed period", async () => {
    const draft = await createJournalEntryDraft(ownerCtx, {
      date: closedPostingDate,
      postingDate: closedPostingDate,
      memo: "Integration closed period posting",
      lines: [
        {
          accountId: debitAccountId,
          debitCents: 5000,
          creditCents: 0,
        },
        {
          accountId: creditAccountId,
          debitCents: 0,
          creditCents: 5000,
        },
      ],
    });

    await expect(
      submitJournalEntry(ownerCtx, {
        journalEntryId: draft.id,
        postingDate: closedPostingDate,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    const glCount = await prisma.gLEntry.count({
      where: { companyId, journalEntryId: draft.id },
    });
    expect(glCount).toBe(0);
  });

  it("denies create journal entry API for member without accounting write permission", async () => {
    const request = new Request("http://localhost/api/v1/accounting/journal-entries", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `iam_session=${memberSessionToken}`,
        "x-company-id": companyId,
      },
      body: JSON.stringify({
        date: openPostingDate.toISOString(),
        postingDate: openPostingDate.toISOString(),
        memo: "Permission denied write check",
        lines: [
          {
            accountId: debitAccountId,
            debitCents: 2500,
            creditCents: 0,
          },
          {
            accountId: creditAccountId,
            debitCents: 0,
            creditCents: 2500,
          },
        ],
      }),
    });

    const response = await createJournalEntryRoute(request);
    const body = (await response.json()) as {
      ok: boolean;
      error?: { code?: string };
    };

    expect(response.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("FORBIDDEN");
  });
});
