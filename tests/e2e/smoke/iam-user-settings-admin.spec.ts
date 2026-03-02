import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../../src/lib/prisma";

const STRONG_PASSWORD = "StrongPassword123!";

async function signUp(
  page: Page,
  input: {
    name: string;
    email: string;
    companyName: string;
    companySlug: string;
  },
) {
  await page.goto("/auth/sign-up");
  await page.getByPlaceholder("Full name").fill(input.name);
  await page.getByPlaceholder("you@company.com").fill(input.email);
  await page.getByPlaceholder("Company name").fill(input.companyName);
  await page.getByPlaceholder("company-slug").fill(input.companySlug);
  await page.getByPlaceholder("Strong password (12+ chars)").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/, { timeout: 90_000 });
}

async function cleanupByMarker(marker: string) {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: marker } },
    select: { id: true, activeCompanyId: true },
  });
  const userIds = users.map((row) => row.id);
  const companyIds = Array.from(
    new Set(users.map((row) => row.activeCompanyId).filter((row): row is string => Boolean(row))),
  );

  if (userIds.length > 0) {
    await prisma.iamSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.companyMembershipPermission.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
  }

  if (companyIds.length > 0) {
    await prisma.iamRolePermission.deleteMany({ where: { role: { companyId: { in: companyIds } } } });
    await prisma.iamRole.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

test.describe("smoke: iam settings and admin routes", () => {
  test("user settings pages render and non-admin users are blocked from admin users", async ({ page }) => {
    const marker = `iam-user-${Date.now()}`;

    try {
      await signUp(page, {
        name: "IAM Settings User",
        email: `${marker}@example.com`,
        companyName: `${marker}-company`,
        companySlug: `${marker}-slug`,
      });

      await page.goto("/settings/user");
      await expect(page.getByRole("heading", { name: "User Settings" })).toBeVisible();
      await page.goto("/settings/user/sessions");
      await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();

      await page.goto("/admin/users");
      await expect(page).toHaveURL(/\/dashboard$/);
    } finally {
      await cleanupByMarker(marker);
    }
  });

  test("platform admins can open the ERPNext-style user admin list and record page", async ({ page }) => {
    const marker = `iam-admin-${Date.now()}`;

    try {
      await signUp(page, {
        name: "IAM Admin User",
        email: `${marker}@example.com`,
        companyName: `${marker}-company`,
        companySlug: `${marker}-slug`,
      });

      const user = await prisma.user.findUnique({
        where: { email: `${marker}@example.com` },
        select: { id: true },
      });
      if (!user) throw new Error("Seeded user not found");

      await prisma.user.update({
        where: { id: user.id },
        data: { platformRole: "SUPER_ADMIN" },
      });

      await page.reload();
      await page.goto("/admin/users");
      await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
      await page.getByRole("link", { name: "Open" }).first().click();
      await expect(page).toHaveURL(/\/admin\/users\//);
      await expect(page.getByRole("button", { name: "Permissions" })).toBeVisible();
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
