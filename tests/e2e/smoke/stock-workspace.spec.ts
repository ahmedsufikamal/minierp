import { expect, test, type Page } from "@playwright/test";
import { Prisma } from "@prisma/client";
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

async function cleanupMarker(marker: string) {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: marker } },
    select: { id: true, activeCompanyId: true },
  });
  const userIds = users.map((row) => row.id);
  const membershipRows = userIds.length
    ? await prisma.companyMembership.findMany({
        where: { userId: { in: userIds } },
        select: { companyId: true },
      })
    : [];
  const companyIds = Array.from(
    new Set([
      ...users.map((row) => row.activeCompanyId).filter((row): row is string => Boolean(row)),
      ...membershipRows.map((row) => row.companyId),
    ]),
  );

  if (companyIds.length > 0) {
    const deleteManyIfPresent = async (runner: () => Promise<unknown>) => {
      try {
        await runner();
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2021" || error.code === "P2022")
        ) {
          return;
        }
        throw error;
      }
    };

    await deleteManyIfPresent(() =>
      prisma.inventorySettingComment.deleteMany({ where: { companyId: { in: companyIds } } }),
    );
    await prisma.inventoryAuditLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await deleteManyIfPresent(() =>
      prisma.inventoryItemTag.deleteMany({ where: { companyId: { in: companyIds } } }),
    );
    await prisma.inventoryNotification.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryLedgerEntry.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryDocumentLine.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryWorkflowState.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryDocument.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryReorderRule.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryWarehouseLocation.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryWarehouse.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryItemIdentifier.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.product.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.brand.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.iamSession.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyMembership.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }

  if (userIds.length > 0) {
    await prisma.iamSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

test.describe("smoke: stock workspace ui", () => {
  test("loads workspace, opens items, updates query params, and renders settings shell", async ({ page }) => {
    const marker = `stock-workspace-${Date.now()}`;
    try {
      await signUp(page, {
        name: "Stock Workspace User",
        email: `${marker}@example.com`,
        companyName: `${marker} Company`,
        companySlug: `${marker}-co`,
      });

      await page.goto("/stock", { waitUntil: "domcontentloaded" });
      await expect(page.getByLabel("Breadcrumb").getByText("Stock", { exact: true })).toBeVisible();
      await expect(page.getByText("Warehouse wise Stock Value")).toBeVisible();
      await expect(page.getByText("Operational Snapshot")).toBeVisible();
      await expect(page.getByText("Masters & Reports")).toBeVisible();

      await page.getByRole("link", { name: "Items Available" }).click();
      await expect(page).toHaveURL(/\/stock\/setup\/item/);
      await expect(page.getByRole("heading", { name: "Items", level: 1 })).toBeVisible();

      await page.getByPlaceholder("Item Name / Item Code").fill("Samsung");
      await expect
        .poll(() => page.url(), { timeout: 30_000 })
        .toContain("query=Samsung");

      await page.goto("/stock/settings", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Stock Settings", level: 1 })).toBeVisible();
      await expect(page.getByText("Assigned To")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Comments" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Stock Validations" })).toBeVisible();
    } finally {
      await cleanupMarker(marker);
    }
  });
});
