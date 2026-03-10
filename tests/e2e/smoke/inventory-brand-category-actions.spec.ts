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

  const userIds = users.map((user) => user.id);
  const membershipRows = userIds.length
    ? await prisma.companyMembership.findMany({
      where: { userId: { in: userIds } },
      select: { companyId: true },
    })
    : [];
  const companyIds = Array.from(new Set([
    ...users.map((user) => user.activeCompanyId).filter((value): value is string => Boolean(value)),
    ...membershipRows.map((row) => row.companyId),
  ]));

  if (companyIds.length > 0) {
    await prisma.subCategory.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.category.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.brand.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.iamSession.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyMembership.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }

  if (userIds.length > 0) {
    await prisma.iamSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.iamLoginAttempt.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

test.describe("smoke: inventory brand/category actions", () => {
  test("create and delete brands and categories without server action serialization errors", async ({ page }) => {
    const marker = `inventory-taxonomy-${Date.now()}`;
    const ownerEmail = `${marker}@example.com`;
    const companySlug = `${marker}-company`;
    const brandName = `${marker}-brand`;
    const categoryName = `${marker}-category`;

    try {
      await signUp(page, {
        name: "Inventory Taxonomy Owner",
        email: ownerEmail,
        companyName: `${marker} Company`,
        companySlug,
      });

      await page.goto("/stock/setup/brand", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Brands", exact: true })).toBeVisible();
      const brandForm = page.locator("form").filter({ has: page.getByPlaceholder("Brand name") });
      await brandForm.getByPlaceholder("Brand name").fill(brandName);
      await brandForm.getByRole("button", { name: "Create" }).click();

      const brandRow = page.locator("tbody tr", { hasText: brandName });
      await expect(brandRow).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Application error");

      await brandRow.getByRole("button", { name: "Delete" }).click();
      await expect(brandRow).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Application error");

      await page.goto("/inventory/categories", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();
      const categoryForm = page.locator("form").filter({ has: page.getByPlaceholder("Category name") });
      await categoryForm.getByPlaceholder("Category name").fill(categoryName);
      await categoryForm.getByRole("button", { name: "Create" }).click();

      const categoryRow = page.locator("tbody tr", { hasText: categoryName });
      await expect(categoryRow).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Application error");

      await categoryRow.getByRole("button", { name: "Delete" }).click();
      await expect(categoryRow).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Application error");
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
