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
  await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);
}

async function cleanupByMarker(marker: string) {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: marker } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);

  if (companyIds.length > 0) {
    await prisma.salesInvoiceLine.deleteMany({
      where: { invoice: { companyId: { in: companyIds } } },
    });
    await prisma.salesInvoice.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.product.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.brand.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.customer.deleteMany({
      where: { companyId: { in: companyIds } },
    });

    await prisma.iamInvitation.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.iamSession.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.iamRolePermission.deleteMany({
      where: { role: { companyId: { in: companyIds } } },
    });
    await prisma.iamRole.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: companyIds } },
    });
  }

  await prisma.iamSession.deleteMany({
    where: { user: { email: { startsWith: marker } } },
  });
  await prisma.companyMembership.deleteMany({
    where: { user: { email: { startsWith: marker } } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: marker } },
  });
}

test.describe("smoke: sidebar dashboard pinning", () => {
  test("keeps dashboard first, standalone, routable, and active in desktop and mobile sidebar", async ({ page }) => {
    const marker = `sidebar-dash-${Date.now()}`;

    try {
      await signUp(page, {
        name: "Sidebar Dash User",
        email: `${marker}@example.com`,
        companyName: `${marker}-company`,
        companySlug: `${marker}-slug`,
      });

      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto("/selling/customers");

      const desktopSidebar = page.locator('aside[aria-label="Primary"]:visible');
      const desktopNavRoot = desktopSidebar.locator('[data-testid="sidebar-nav-root"]');
      const desktopDashboardLink = desktopNavRoot.locator('[data-testid="sidebar-dashboard-link"]');

      await expect(desktopDashboardLink).toBeVisible();
      await expect(desktopNavRoot.locator("a").first()).toHaveAttribute("href", "/dashboard");

      const nestedInSection = await desktopDashboardLink.evaluate((element) => Boolean(element.closest("section")));
      expect(nestedInSection).toBe(false);

      await desktopDashboardLink.click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(
        page.locator('aside[aria-label="Primary"]:visible [data-testid="sidebar-dashboard-link"]'),
      ).toHaveAttribute("aria-current", "page");

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/selling/customers");
      await page.getByRole("button", { name: "Open sidebar" }).click();

      const mobileSidebar = page.locator('div[role="dialog"] aside[aria-label="Primary"]');
      const mobileNavRoot = mobileSidebar.locator('[data-testid="sidebar-nav-root"]');
      const mobileDashboardLink = mobileNavRoot.locator('[data-testid="sidebar-dashboard-link"]');

      await expect(mobileDashboardLink).toBeVisible();
      await expect(mobileNavRoot.locator("a").first()).toHaveAttribute("href", "/dashboard");

      await mobileDashboardLink.click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.getByRole("button", { name: "Open sidebar" }).click();
      await expect(
        page.locator('div[role="dialog"] aside[aria-label="Primary"] [data-testid="sidebar-dashboard-link"]'),
      ).toHaveAttribute("aria-current", "page");
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
