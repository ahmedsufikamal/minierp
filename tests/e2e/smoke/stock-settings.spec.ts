import { expect, test, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "../../../src/lib/prisma";

const STRONG_PASSWORD = "StrongPassword123!";
const DEFAULT_COMPANY_ID = "default-org";

async function signIn(page: Page, email: string) {
  await page.goto("/auth/sign-in", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@company.com").fill(email);
  await page.getByPlaceholder("Password").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/, { timeout: 90_000 });
}

async function seedCompanyUser(input: { email: string; name: string; role: "MANAGER" | "MEMBER" }) {
  const passwordHash = await bcrypt.hash(STRONG_PASSWORD, 12);

  await prisma.company.upsert({
    where: { id: DEFAULT_COMPANY_ID },
    update: {},
    create: {
      id: DEFAULT_COMPANY_ID,
      name: "Default Org",
      slug: DEFAULT_COMPANY_ID,
      status: "ACTIVE",
    },
  });

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      companyId: DEFAULT_COMPANY_ID,
      activeCompanyId: DEFAULT_COMPANY_ID,
      status: "ACTIVE",
      mustResetPassword: false,
    },
    select: { id: true },
  });

  await prisma.companyMembership.create({
    data: {
      userId: user.id,
      companyId: DEFAULT_COMPANY_ID,
      role: input.role,
      userTypeLevel: input.role === "MEMBER" ? 3 : 4,
      userTypeLabel: input.role === "MEMBER" ? "GENERAL_USER" : "ADMINISTRATOR_USER",
      status: "ACTIVE",
      isDefault: true,
      joinedAt: new Date(),
    },
  });

  return user.id;
}

async function cleanupByMarker(marker: string) {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: marker } },
    select: { id: true },
  });
  const userIds = users.map((row) => row.id);
  if (!userIds.length) return;

  await prisma.iamSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.iamLoginAttempt.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

test.describe("smoke: stock settings", () => {
  test("writer can save and stale version conflicts", async ({ page }) => {
    const marker = `stock-settings-${Date.now()}`;
    const ownerEmail = `${marker}-owner@example.com`;

    try {
      await seedCompanyUser({
        email: ownerEmail,
        name: "Stock Settings Owner",
        role: "MANAGER",
      });
      await signIn(page, ownerEmail);

      await page.goto("/stock/settings", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Stock Settings" })).toBeVisible();
      await page.getByRole("button", { name: "Stock Validations" }).click();

      const allowNegativeStockToggle = page
        .locator('label:has-text("Allow negative stock") input[type="checkbox"]')
        .first();
      await expect(allowNegativeStockToggle).toBeVisible();
      const beforeValue = await allowNegativeStockToggle.isChecked();
      await allowNegativeStockToggle.click();

      const saveButton = page.getByRole("button", { name: "Save Stock Settings" });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await expect(page.getByText("Stock settings updated").first()).toBeVisible();

      await page.reload();
      await page.getByRole("button", { name: "Stock Validations" }).click();
      await expect(allowNegativeStockToggle).toHaveJSProperty("checked", !beforeValue);

      const getResponse = await page.request.get("/api/stock/settings");
      const getBody = (await getResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { version?: number; show_barcode_field_in_stock_transactions?: boolean };
        error?: { message?: string };
      };
      expect(getResponse.ok(), getBody.error?.message ?? "load stock settings failed").toBeTruthy();
      expect(getBody.ok).toBe(true);

      const currentVersion = getBody.data?.version ?? null;
      const barcodeFlag = getBody.data?.show_barcode_field_in_stock_transactions ?? true;
      expect(typeof currentVersion).toBe("number");
      if (typeof currentVersion !== "number") {
        throw new Error("Missing stock settings version");
      }

      const firstPatch = await page.request.patch("/api/stock/settings", {
        headers: {
          "content-type": "application/json",
          "if-match": String(currentVersion),
        },
        data: {
          show_barcode_field_in_stock_transactions: !barcodeFlag,
          version: currentVersion,
        },
      });
      const firstPatchBody = (await firstPatch.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };
      expect(firstPatch.ok(), firstPatchBody.error?.message ?? "first patch should succeed").toBeTruthy();
      expect(firstPatchBody.ok).toBe(true);

      const stalePatch = await page.request.patch("/api/stock/settings", {
        headers: {
          "content-type": "application/json",
          "if-match": String(currentVersion),
        },
        data: {
          show_barcode_field_in_stock_transactions: barcodeFlag,
          version: currentVersion,
        },
      });
      const stalePatchBody = (await stalePatch.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { code?: string; message?: string };
      };
      expect(stalePatch.status()).toBe(409);
      expect(stalePatchBody.ok).toBe(false);
      expect(stalePatchBody.error?.code).toBe("CONFLICT");
    } finally {
      await cleanupByMarker(marker);
    }
  });

  test("member is read-only on stock settings", async ({ page }) => {
    const marker = `stock-settings-readonly-${Date.now()}`;
    const memberEmail = `${marker}-member@example.com`;

    try {
      await seedCompanyUser({
        email: memberEmail,
        name: "Stock Settings Member",
        role: "MEMBER",
      });
      await signIn(page, memberEmail);

      await page.goto("/stock/settings", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Stock Settings" })).toBeVisible();
      await expect(
        page.getByText("Read-only mode: you do not have permission to update Stock Settings."),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Save Stock Settings" })).toBeDisabled();

      await page.getByRole("button", { name: "Stock Validations" }).click();
      const allowNegativeStockToggle = page
        .locator('label:has-text("Allow negative stock") input[type="checkbox"]')
        .first();
      await expect(allowNegativeStockToggle).toBeDisabled();
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
