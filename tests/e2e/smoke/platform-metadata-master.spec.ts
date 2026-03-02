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
  const safe = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch {
      // Smoke cleanup should not hide primary assertion failures when schema differs.
    }
  };

  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: marker } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);

  if (companyIds.length > 0) {
    await safe(() => prisma.masterPartyMergeHistory.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.masterAddress.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.masterContact.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.masterParty.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.masterPriceListItem.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.masterPriceList.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.masterCurrency.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.masterTaxCode.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.metaChangeLog.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.metaFieldDef.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.metaWorkflowState.deleteMany({ where: { workflowDef: { companyId: { in: companyIds } } } }));
    await safe(() => prisma.metaWorkflowTransition.deleteMany({ where: { workflowDef: { companyId: { in: companyIds } } } }));
    await safe(() => prisma.metaWorkflowDef.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.metaPrintTemplate.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.metaPermissionPolicy.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.metaCustomPermissionType.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.compiledMeta.deleteMany({ where: { companyId: { in: companyIds } } }));
    await safe(() => prisma.metaModel.deleteMany({ where: { companyId: { in: companyIds } } }));

    await safe(() => prisma.iamInvitation.deleteMany({
      where: { companyId: { in: companyIds } },
    }));
    await safe(() => prisma.iamSession.deleteMany({
      where: { companyId: { in: companyIds } },
    }));
    await safe(() => prisma.companyMembership.deleteMany({
      where: { companyId: { in: companyIds } },
    }));
    await safe(() => prisma.iamRolePermission.deleteMany({
      where: { role: { companyId: { in: companyIds } } },
    }));
    await safe(() => prisma.iamRole.deleteMany({
      where: { companyId: { in: companyIds } },
    }));
    await safe(() => prisma.company.deleteMany({
      where: { id: { in: companyIds } },
    }));
  }

  await safe(() => prisma.iamSession.deleteMany({
    where: { user: { email: { startsWith: marker } } },
  }));
  await safe(() => prisma.companyMembership.deleteMany({
    where: { user: { email: { startsWith: marker } } },
  }));
  await safe(() => prisma.user.deleteMany({
    where: { email: { startsWith: marker } },
  }));
}

test.describe("smoke: platform metadata + master data", () => {
  test("loads metadata studio and master data pages", async ({ page }) => {
    const marker = `platform-mdm-${Date.now()}`;

    try {
      await signUp(page, {
        name: "Platform MDM User",
        email: `${marker}@example.com`,
        companyName: `${marker}-company`,
        companySlug: `${marker}-slug`,
      });

      await page.setViewportSize({ width: 1366, height: 900 });

      await page.goto("/platform/metadata");
      await expect(page.getByRole("heading", { name: "Metadata Studio" })).toBeVisible();
      await expect(page.getByText("/api/v1/meta/models")).toBeVisible();

      await page.goto("/platform/master/parties");
      await expect(page.getByRole("heading", { name: "Master Parties" })).toBeVisible();
      await expect(page.getByText("/api/v1/master/parties")).toBeVisible();

      await page.goto("/platform/master/items");
      await expect(page.getByRole("heading", { name: "Master Items" })).toBeVisible();
      await expect(page.getByText("/api/v1/master/items")).toBeVisible();

      await page.goto("/platform/master/pricelists");
      await expect(page.getByRole("heading", { name: "Master Price Lists" })).toBeVisible();
      await expect(page.getByText("/api/v1/master/pricelists")).toBeVisible();
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
