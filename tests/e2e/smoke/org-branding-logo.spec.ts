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
  const companyIds = Array.from(
    new Set([
      ...users.map((user) => user.activeCompanyId).filter((value): value is string => Boolean(value)),
      ...membershipRows.map((row) => row.companyId),
    ]),
  );

  if (companyIds.length > 0) {
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

test.describe("smoke: organization branding logo", () => {
  test("redirects to MFA instead of throwing a server error when step-up is required", async ({
    page,
  }) => {
    const marker = `org-brand-mfa-${Date.now()}`;
    const ownerEmail = `${marker}@example.com`;

    try {
      await signUp(page, {
        name: "Org Branding MFA Owner",
        email: ownerEmail,
        companyName: "YGEN Company",
        companySlug: `${marker}-company`,
      });

      await page.goto("/org/settings", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Organization settings" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => {
        const saveButton = Array.from(document.querySelectorAll("button")).find((button) =>
          button.textContent?.includes("Save settings"),
        );
        return saveButton instanceof HTMLButtonElement && !saveButton.disabled;
      });

      await page.getByRole("button", { name: "Save settings" }).click();

      await expect(page).toHaveURL(/\/auth\/mfa\?required=1&next=%2Forg%2Fsettings/, {
        timeout: 15_000,
      });
      await expect(page.locator("body")).not.toContainText("Application error");
    } finally {
      await cleanupByMarker(marker);
    }
  });

  test("uploads a company logo in org settings and renders it in the top-right header", async ({
    page,
  }) => {
    const marker = `org-brand-${Date.now()}`;
    const ownerEmail = `${marker}@example.com`;

    try {
      await signUp(page, {
        name: "Org Branding Owner",
        email: ownerEmail,
        companyName: "YGEN Company",
        companySlug: `${marker}-company`,
      });

      const user = await prisma.user.findFirst({
        where: { email: ownerEmail },
        select: { id: true, activeCompanyId: true },
      });

      if (!user?.activeCompanyId) {
        throw new Error("Expected the signed-up owner to have an active company.");
      }

      await prisma.iamSession.updateMany({
        where: {
          userId: user.id,
          companyId: user.activeCompanyId,
          revokedAt: null,
        },
        data: {
          stepUpVerifiedAt: new Date(),
        },
      });

      await page.goto("/org/settings", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Organization settings" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => {
        const saveButton = Array.from(document.querySelectorAll("button")).find((button) =>
          button.textContent?.includes("Save settings"),
        );
        const fileInput = document.querySelector("[data-testid='org-branding-file-input']");
        return (
          saveButton instanceof HTMLButtonElement &&
          !saveButton.disabled &&
          fileInput instanceof HTMLInputElement &&
          !fileInput.disabled
        );
      });

      await page.getByTestId("org-branding-file-input").setInputFiles({
        name: "ygen-logo.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="72" viewBox="0 0 240 72"><rect width="240" height="72" rx="14" fill="#0f172a"/><text x="120" y="45" font-size="28" font-family="Arial" text-anchor="middle" fill="#f8fafc">YGEN</text></svg>`,
        ),
      });

      await page.waitForFunction(
        () => Boolean(document.querySelector("[data-testid='org-branding-preview'] img")),
        undefined,
        { timeout: 15_000 },
      );

      await Promise.all([
        page.waitForLoadState("networkidle"),
        page.getByRole("button", { name: "Save settings" }).click(),
      ]);

      await expect(page.getByTestId("topbar-company-brand").locator("img")).toBeVisible();
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
