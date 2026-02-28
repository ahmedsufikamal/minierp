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
  await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/, { timeout: 30_000 });
}

async function cleanupByMarker(marker: string) {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: marker } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);

  if (companyIds.length > 0) {
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

test.describe("smoke: floating menus", () => {
  test("renders opaque floating layers and prevents click-through", async ({ page }) => {
    const marker = `floating-layers-${Date.now()}`;

    try {
      await signUp(page, {
        name: "Floating Layers User",
        email: `${marker}@example.com`,
        companyName: `${marker}-company`,
        companySlug: `${marker}-slug`,
      });

      await page.goto("/dev/floating-layers");

      await page.getByTestId("floating-dropdown-trigger").click();

      const dropdownItem = page.getByTestId("floating-dropdown-item");
      await expect(dropdownItem).toBeVisible();

      const dropdownMenu = page.getByRole("menu").filter({ has: dropdownItem });
      const dropdownStyles = await dropdownMenu.evaluate((element) => {
        const styles = window.getComputedStyle(element);
        return {
          backgroundColor: styles.backgroundColor,
          pointerEvents: styles.pointerEvents,
          zIndex: styles.zIndex,
        };
      });

      expect(dropdownStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(dropdownStyles.pointerEvents).toBe("auto");
      expect(Number(dropdownStyles.zIndex)).toBeGreaterThanOrEqual(70);

      await dropdownItem.click();
      await expect(page.getByTestId("menu-action-count")).toContainText("Menu actions: 1");
      await expect(page.getByTestId("background-click-count")).toContainText("Background clicks: 0");

      await page.getByTestId("floating-dialog-trigger").click();

      const dialog = page.getByTestId("floating-dialog-content");
      await expect(dialog).toBeVisible();

      const dialogStyles = await dialog.evaluate((element) => {
        const styles = window.getComputedStyle(element);
        return {
          backgroundColor: styles.backgroundColor,
          pointerEvents: styles.pointerEvents,
          zIndex: styles.zIndex,
        };
      });

      expect(dialogStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(dialogStyles.pointerEvents).toBe("auto");
      expect(Number(dialogStyles.zIndex)).toBeGreaterThanOrEqual(81);

      await page.getByTestId("floating-dialog-action").click();
      await expect(page.getByTestId("dialog-action-count")).toContainText("Dialog actions: 1");

      await page.getByTestId("floating-command-trigger").click();
      const commandDialog = page.getByRole("dialog").filter({ has: page.locator("[cmdk-root]") });
      await expect(commandDialog).toBeVisible();

      const commandStyles = await commandDialog.evaluate((element) => {
        const styles = window.getComputedStyle(element);
        return {
          backgroundColor: styles.backgroundColor,
          pointerEvents: styles.pointerEvents,
          zIndex: styles.zIndex,
        };
      });

      expect(commandStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(commandStyles.pointerEvents).toBe("auto");
      expect(Number(commandStyles.zIndex)).toBeGreaterThanOrEqual(81);
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
