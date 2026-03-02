import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../../src/lib/prisma";

const THEME_STORAGE_KEY = "minierp-ui-theme";
const STRONG_PASSWORD = "StrongPassword123!";

async function seedThemeStorage(page: Page, mode: "light" | "dark" | "system") {
  await page.addInitScript(
    ([key, value]) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    [THEME_STORAGE_KEY, mode],
  );
}

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

async function expectHtmlThemeClass(page: Page, expectedClass: "light" | "dark") {
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(
            (themeClass) => Boolean(document.documentElement?.classList.contains(themeClass)),
            expectedClass,
          );
        } catch {
          return false;
        }
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function assertThemeContrastOnInventoryPage(page: Page) {
  const result = await page.evaluate(() => {
    const selectors = [
      "body",
      ".surface-1",
      ".surface-2",
      ".surface-3",
      "table",
      "button",
      "input",
      "select",
      "textarea",
      "aside",
      "header",
    ];
    const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))).slice(0, 80);

    const parseRgb = (value: string): [number, number, number, number] => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return [255, 255, 255, 1];
      const parts = match[1]
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((part) => !Number.isNaN(part));
      const [r = 255, g = 255, b = 255, a = 1] = parts;
      return [r, g, b, a];
    };

    const toLinear = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    const luminance = ([r, g, b]: [number, number, number]) =>
      0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    const contrastRatio = (a: [number, number, number], b: [number, number, number]) => {
      const la = luminance(a);
      const lb = luminance(b);
      const lighter = Math.max(la, lb);
      const darker = Math.min(la, lb);
      return (lighter + 0.05) / (darker + 0.05);
    };

    const bodyBackground = getComputedStyle(document.body).backgroundColor;
    const bodyRgb = parseRgb(bodyBackground);

    let checked = 0;
    let minContrast = Number.POSITIVE_INFINITY;
    const failures: Array<{ tag: string; contrast: number }> = [];

    for (const node of nodes) {
      const style = getComputedStyle(node);
      const text = parseRgb(style.color);
      const background = parseRgb(style.backgroundColor);
      const bg = background[3] < 0.95 ? bodyRgb : background;

      const ratio = contrastRatio(
        [text[0], text[1], text[2]],
        [bg[0], bg[1], bg[2]],
      );
      if (!Number.isFinite(ratio)) continue;
      checked += 1;
      minContrast = Math.min(minContrast, ratio);
      if (ratio < 2.8) {
        failures.push({ tag: node.tagName.toLowerCase(), contrast: ratio });
      }
    }

    return {
      checked,
      minContrast: Number.isFinite(minContrast) ? minContrast : null,
      failures: failures.slice(0, 10),
    };
  });

  expect(result.checked).toBeGreaterThan(0);
  expect(result.failures, `contrast failures: ${JSON.stringify(result.failures)}`).toHaveLength(0);
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

test.describe("smoke: inventory theme persistence and contrast", () => {
  test("light and dark persist across stock routes with readable contrast", async ({ page }) => {
    const marker = `inv-theme-${Date.now()}`;
    try {
      await seedThemeStorage(page, "light");
      await signUp(page, {
        name: "Inventory Theme User",
        email: `${marker}@example.com`,
        companyName: `${marker}-company`,
        companySlug: `${marker}-slug`,
      });

      for (const mode of ["light", "dark"] as const) {
        await page.evaluate(
          ([key, value]) => window.localStorage.setItem(key, value),
          [THEME_STORAGE_KEY, mode],
        );
        await page.goto("/stock");
        await expectHtmlThemeClass(page, mode);
        await assertThemeContrastOnInventoryPage(page);

        await page.goto("/stock/items");
        await expectHtmlThemeClass(page, mode);
        await assertThemeContrastOnInventoryPage(page);

        await page.reload();
        await expectHtmlThemeClass(page, mode);
      }
    } finally {
      await cleanupMarker(marker);
    }
  });

  test("system mode follows OS color scheme changes on inventory routes", async ({ page }) => {
    const marker = `inv-theme-system-${Date.now()}`;
    try {
      await seedThemeStorage(page, "system");
      await signUp(page, {
        name: "Inventory System Theme User",
        email: `${marker}@example.com`,
        companyName: `${marker}-company`,
        companySlug: `${marker}-slug`,
      });

      await page.goto("/stock");

      await page.emulateMedia({ colorScheme: "dark" });
      await expectHtmlThemeClass(page, "dark");

      await page.emulateMedia({ colorScheme: "light" });
      await expectHtmlThemeClass(page, "light");
    } finally {
      await cleanupMarker(marker);
    }
  });
});
