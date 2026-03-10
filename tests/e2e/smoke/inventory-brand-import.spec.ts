import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../../src/lib/prisma";
import * as XLSX from "xlsx";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

async function createWorkbookFile(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Brands");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "brand-import-"));
  const filePath = path.join(tempDir, "brands.xlsx");
  await writeFile(filePath, buffer);
  return {
    filePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

test.describe("smoke: brand import", () => {
  test("imports valid brands and skips invalid rows with clear preview reasons", async ({ page }) => {
    const marker = `brand-import-${Date.now()}`;
    const ownerEmail = `${marker}@example.com`;
    const companySlug = `${marker}-company`;
    const existingBrand = `${marker}-existing`;
    const validBrandA = `${marker}-alpha`;
    const validBrandB = `${marker}-beta`;

    let cleanupFile: (() => Promise<void>) | null = null;

    try {
      await signUp(page, {
        name: "Brand Import Owner",
        email: ownerEmail,
        companyName: `${marker} Company`,
        companySlug,
      });

      const user = await prisma.user.findFirst({
        where: { email: ownerEmail },
        select: { activeCompanyId: true },
      });
      if (!user?.activeCompanyId) {
        throw new Error("Expected the signed-up owner to have an active company.");
      }

      await prisma.brand.create({
        data: {
          companyId: user.activeCompanyId,
          name: existingBrand,
        },
      });

      const workbook = await createWorkbookFile([
        ["Brand Name"],
        [existingBrand],
        [validBrandA],
        ["   "],
        [validBrandA.toUpperCase()],
        [validBrandB],
      ]);
      cleanupFile = workbook.cleanup;

      await page.goto("/stock/setup/brand", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Brands", exact: true })).toBeVisible();

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: "Download Template" }).click(),
      ]);
      expect(download.suggestedFilename()).toBe("brand-import-template.xlsx");

      await page.getByRole("button", { name: "Import Brands" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      await page.locator('input[type="file"]').setInputFiles(workbook.filePath);
      await page.getByRole("button", { name: "Preview Data" }).click();

      await expect(page.getByText("Preview rows")).toBeVisible();
      await expect(page.getByText("Brand already exists.")).toBeVisible();
      await expect(page.getByText("Brand Name is required.")).toBeVisible();
      await expect(page.getByText("Duplicate brand name in file.")).toBeVisible();

      await page.getByRole("button", { name: /Import Valid Rows \(2\)/ }).click();

      await expect(page.getByText("Brand import complete")).toBeVisible();
      await expect(page.getByText("Successful imports")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Application error");

      await page.getByRole("button", { name: "Done" }).click();

      await expect(page.getByText(validBrandA)).toBeVisible();
      await expect(page.getByText(validBrandB)).toBeVisible();
      await expect(page.getByText(existingBrand)).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Application error");
    } finally {
      if (cleanupFile) {
        await cleanupFile();
      }
      await cleanupByMarker(marker);
    }
  });
});
