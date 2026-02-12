import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { hashToken } from "../src/modules/iam/infrastructure/crypto";

const STRONG_PASSWORD = "StrongPassword123!";

async function cleanupByMarker(marker: string) {
  await prisma.iamAuditLog.deleteMany({
    where: {
      entityId: { contains: marker },
    },
  });
  await prisma.iamRecoveryCode.deleteMany({
    where: { user: { email: { contains: marker } } },
  });
  await prisma.iamMfaFactor.deleteMany({
    where: { user: { email: { contains: marker } } },
  });
  await prisma.iamInvitation.deleteMany({
    where: {
      OR: [
        { email: { contains: marker } },
        { company: { slug: { contains: marker } } },
      ],
    },
  });
  await prisma.iamSession.deleteMany({
    where: {
      OR: [
        { user: { email: { contains: marker } } },
        { company: { slug: { contains: marker } } },
      ],
    },
  });
  await prisma.companyMembership.deleteMany({
    where: {
      OR: [
        { user: { email: { contains: marker } } },
        { company: { slug: { contains: marker } } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { email: { contains: marker } } });
  await prisma.company.deleteMany({ where: { slug: { contains: marker } } });
}

async function signUp(page: Page, input: {
  name: string;
  email: string;
  companyName?: string;
  companySlug?: string;
  inviteToken?: string;
}) {
  const inviteQuery = input.inviteToken ? `?invite=${encodeURIComponent(input.inviteToken)}` : "";
  await page.goto(`/auth/sign-up${inviteQuery}`);
  await page.getByPlaceholder("Full name").fill(input.name);
  await page.getByPlaceholder("you@company.com").fill(input.email);
  if (input.companyName) {
    await page.getByPlaceholder("Company name").fill(input.companyName);
  }
  if (input.companySlug) {
    await page.getByPlaceholder("company-slug").fill(input.companySlug);
  }
  await page.getByPlaceholder("Strong password (12+ chars)").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

test.describe("IAM acceptance flows", () => {
  test("full invite claim + org switch + role assignment enforces server permissions", async ({ page, browser }) => {
    const marker = `e2e-flow-${Date.now()}`;
    const ownerEmail = `${marker}-owner@example.com`;
    const inviteeEmail = `${marker}-invitee@example.com`;
    const secondarySlug = `${marker}-ops`;

    try {
      await signUp(page, {
        name: "Owner User",
        email: ownerEmail,
        companyName: `${marker} Main`,
        companySlug: `${marker}-main`,
      });
      await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);

      await page.goto("/org/new");
      await page.getByLabel("Organization name").fill(`${marker} Ops`);
      await page.getByLabel("Slug (optional)").fill(secondarySlug);
      await page.getByRole("button", { name: "Create organization" }).click();
      await page.goto("/org/select");
      const secondaryCard = page.locator("form").filter({ hasText: `${marker} Ops` }).first();
      await expect(secondaryCard).toBeVisible();
      const switchButton = secondaryCard.getByRole("button", { name: "Switch" });
      if (await switchButton.count()) {
        await switchButton.click();
      } else {
        await expect(secondaryCard.getByRole("button", { name: "Active" })).toBeVisible();
      }

      const ownerUser = await prisma.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true },
      });
      const secondaryOrg = await prisma.company.findUnique({
        where: { slug: secondarySlug },
        select: { id: true },
      });
      expect(ownerUser?.id).toBeTruthy();
      expect(secondaryOrg?.id).toBeTruthy();
      if (!ownerUser?.id || !secondaryOrg?.id) {
        throw new Error("Failed to create owner or secondary org fixture");
      }

      const memberRole = await prisma.iamRole.findUnique({
        where: { companyId_name: { companyId: secondaryOrg.id, name: "MEMBER" } },
        select: { id: true },
      });
      const inviteToken = `${marker}-invite-token-abcdefghijklmnop`;
      await prisma.iamInvitation.create({
        data: {
          companyId: secondaryOrg.id,
          email: inviteeEmail,
          roleId: memberRole?.id ?? null,
          tokenHash: hashToken(inviteToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          createdByUserId: ownerUser.id,
        },
      });

      const inviteeContext = await browser.newContext();
      const inviteePage = await inviteeContext.newPage();
      await signUp(inviteePage, {
        name: "Invitee User",
        email: inviteeEmail,
        inviteToken,
      });
      await expect(inviteePage).toHaveURL(/\/dashboard|\/auth\/mfa/);
      await inviteeContext.close();

      await prisma.iamSession.updateMany({
        where: { userId: ownerUser.id, revokedAt: null },
        data: { stepUpVerifiedAt: new Date() },
      });

      await page.goto("/org/members");
      const inviteeCard = page.locator("div.rounded-lg.border.p-4").filter({ hasText: inviteeEmail }).first();
      await expect(inviteeCard).toBeVisible();
      await inviteeCard.locator('select[name="roleId"]').selectOption({ label: "VIEWER" });
      await inviteeCard.getByRole("button", { name: "Update role" }).click();

      const inviteeRole = await prisma.companyMembership.findUnique({
        where: {
          userId_companyId: {
            userId: (
              await prisma.user.findUnique({
                where: { email: inviteeEmail },
                select: { id: true },
              })
            )!.id,
            companyId: secondaryOrg.id,
          },
        },
        select: { role: true },
      });
      expect(inviteeRole?.role).toBe("VIEWER");

      const viewerContext = await browser.newContext();
      const viewerPage = await viewerContext.newPage();
      await viewerPage.goto("/auth/sign-in");
      await viewerPage.getByPlaceholder("you@company.com").fill(inviteeEmail);
      await viewerPage.getByPlaceholder("Password").fill(STRONG_PASSWORD);
      await viewerPage.getByRole("button", { name: "Sign in with password" }).click();
      await expect(viewerPage).toHaveURL(/\/dashboard|\/auth\/mfa/);

      const forbidden = await viewerPage.request.post(`/api/orgs/${secondaryOrg.id}/roles`, {
        data: {
          name: "Nope",
          description: "forbidden",
          permissionKeys: ["admin.settings"],
        },
      });
      expect(forbidden.status()).toBe(403);
      const forbiddenPayload = await forbidden.json();
      expect(forbiddenPayload?.error?.code).toBe("FORBIDDEN");
      await viewerContext.close();
    } finally {
      await cleanupByMarker(marker);
    }
  });

  test("step-up is required before protected org policy mutation and succeeds after MFA recovery verification", async ({ page }) => {
    const marker = `e2e-stepup-${Date.now()}`;
    const email = `${marker}@example.com`;

    try {
      await signUp(page, {
        name: "Step Up User",
        email,
        companyName: `${marker} Co`,
        companySlug: `${marker}-co`,
      });
      await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, activeCompanyId: true },
      });
      expect(user?.id).toBeTruthy();
      expect(user?.activeCompanyId).toBeTruthy();
      if (!user?.id || !user.activeCompanyId) {
        throw new Error("Failed to create step-up user fixture");
      }

      const blocked = await page.request.post(`/api/orgs/${user.activeCompanyId}/auto-join-rules`, {
        data: {
          ruleType: "EMAIL_ALLOWLIST",
          config: { allowlist: [email] },
          isEnabled: true,
        },
      });
      expect(blocked.status()).toBe(428);
      const blockedPayload = await blocked.json();
      expect(blockedPayload?.error?.code).toBe("STEP_UP_REQUIRED");

      const factor = await prisma.iamMfaFactor.create({
        data: {
          userId: user.id,
          type: "TOTP",
          label: "E2E Recovery",
          isVerified: true,
          verifiedAt: new Date(),
          isPrimary: true,
        },
        select: { id: true },
      });
      const recoveryCode = `${marker}-RECOVERY`.toUpperCase();
      await prisma.iamRecoveryCode.create({
        data: {
          userId: user.id,
          factorId: factor.id,
          codeHash: hashToken(recoveryCode),
        },
      });

      const verified = await page.request.post("/api/auth/mfa/recovery/verify", {
        data: { code: recoveryCode },
      });
      expect(verified.status()).toBe(200);

      const allowed = await page.request.post(`/api/orgs/${user.activeCompanyId}/auto-join-rules`, {
        data: {
          ruleType: "EMAIL_ALLOWLIST",
          config: { allowlist: [email] },
          isEnabled: true,
        },
      });
      expect(allowed.status()).toBe(201);
    } finally {
      await cleanupByMarker(marker);
    }
  });

  test("tenant host mapping applies auth branding on sign-in", async ({ page }) => {
    const marker = `e2e-brand-${Date.now()}`;
    const hostDomain = "127.0.0.1.nip.io";
    const logoUrl = `https://example.com/${marker}.svg`;

    try {
      await prisma.company.create({
        data: {
          name: `${marker} Brand Co`,
          slug: `${marker}-brand`,
          status: "ACTIVE",
          primaryDomain: hostDomain,
          logoUrl,
          allowedAuthMethods: ["PASSWORD"],
        },
      });

      await page.goto(`http://${hostDomain}:3000/auth/sign-in`);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      const logo = page.locator('img[alt="Tenant logo"]').first();
      await expect(logo).toBeVisible();
      await expect(logo).toHaveAttribute("src", logoUrl);
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
