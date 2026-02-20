import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../../src/lib/prisma";
import { hashToken } from "../../../src/modules/iam/infrastructure/crypto";

const STRONG_PASSWORD = "StrongPassword123!";

async function signUp(
  page: Page,
  input: {
    name: string;
    email: string;
    companyName?: string;
    companySlug?: string;
    inviteToken?: string;
  },
) {
  const inviteQuery = input.inviteToken ? `?invite=${encodeURIComponent(input.inviteToken)}` : "";
  await page.goto(`/auth/sign-up${inviteQuery}`);
  await page.getByPlaceholder("Full name").fill(input.name);
  await page.getByPlaceholder("you@company.com").fill(input.email);
  if (input.companyName) {
    await page.getByPlaceholder("Company name").fill(input.companyName);
  }
  if (input.companySlug) {
    await page.getByPlaceholder("company-slug").fill(input.companySlug);
  }
  await page.getByPlaceholder("Strong password (12+ chars)").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function signIn(page: Page, email: string) {
  await page.goto("/auth/sign-in");
  await page.getByPlaceholder("you@company.com").fill(email);
  await page.getByPlaceholder("Password").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Sign in with password" }).click();
}

async function cleanupByMarker(marker: string) {
  const companies = await prisma.company.findMany({
    where: { slug: { contains: marker } },
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
    where: { user: { email: { contains: marker } } },
  });
  await prisma.companyMembership.deleteMany({
    where: { user: { email: { contains: marker } } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: marker } },
  });
}

test.describe("smoke: critical ERP flows", () => {
  test("sign in, org create, invite/join, item create, invoice create", async ({ page, browser }) => {
    const marker = `smoke-${Date.now()}`;
    const ownerEmail = `${marker}-owner@example.com`;
    const inviteeEmail = `${marker}-invitee@example.com`;
    const mainSlug = `${marker}-main`;
    const productName = `${marker}-item`;
    const customerName = `${marker}-customer`;
    const invoiceNumber = `INV-${Date.now()}`;

    try {
      // 1) Sign up then sign in using the normal auth flow.
      await signUp(page, {
        name: "Smoke Owner",
        email: ownerEmail,
        companyName: `${marker} Main`,
        companySlug: mainSlug,
      });
      await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);

      const signInContext = await browser.newContext();
      const signInPage = await signInContext.newPage();
      await signIn(signInPage, ownerEmail);
      await expect(signInPage).toHaveURL(/\/dashboard|\/auth\/mfa/);
      await signInContext.close();

      // 2) Organization creation happened during sign-up (companyName/companySlug).
      // 3) Invite and join a second user inside the active organization.
      const ownerUser = await prisma.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true, activeCompanyId: true },
      });
      expect(ownerUser?.id).toBeTruthy();
      expect(ownerUser?.activeCompanyId).toBeTruthy();
      if (!ownerUser?.id || !ownerUser?.activeCompanyId) {
        throw new Error("Failed to resolve owner/organization fixtures");
      }

      const memberRole = await prisma.iamRole.findUnique({
        where: { companyId_name: { companyId: ownerUser.activeCompanyId, name: "MEMBER" } },
        select: { id: true },
      });

      const inviteToken = `${marker}-invite-token-abcdefghijklmnop`;
      await prisma.iamInvitation.create({
        data: {
          companyId: ownerUser.activeCompanyId,
          email: inviteeEmail,
          roleId: memberRole?.id ?? null,
          tokenHash: hashToken(inviteToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          createdByUserId: ownerUser.id,
        },
      });

      const inviteeContext = await browser.newContext();
      const inviteePage = await inviteeContext.newPage();
      await signUp(inviteePage, {
        name: "Smoke Invitee",
        email: inviteeEmail,
        inviteToken,
      });
      await expect(inviteePage).toHaveURL(/\/dashboard|\/auth\/mfa/);
      const inviteeMembership = await prisma.companyMembership.findFirst({
        where: {
          companyId: ownerUser.activeCompanyId,
          user: { email: inviteeEmail },
        },
        select: { status: true },
      });
      expect(inviteeMembership?.status).toBe("ACTIVE");
      await inviteeContext.close();

      // 4) Create an item/product.
      await page.goto("/products");
      await page.locator("#add-product").click();
      await page.getByPlaceholder("SKU (e.g., P-001)").fill(`SKU-${Date.now()}`);
      await page.getByPlaceholder("Product name").fill(productName);
      await page.getByPlaceholder("UOM (pcs, kg)").fill("pcs");
      await page.getByPlaceholder("Default price").fill("120");
      const addProductForm = page.locator('form:has(input[name="sku"])').first();
      await expect(addProductForm).toBeVisible();
      await addProductForm.getByRole("button", { name: "Create" }).click();
      await expect
        .poll(
          async () =>
            prisma.product.count({
              where: {
                companyId: ownerUser.activeCompanyId,
                name: productName,
              },
            }),
          { timeout: 10_000 },
        )
        .toBeGreaterThan(0);

      // Create customer prerequisite for invoice flow.
      await page.goto("/customers");
      await page.getByRole("button", { name: "Add Customer" }).click();
      const customerDialog = page.getByRole("dialog");
      await expect(customerDialog).toBeVisible();
      await customerDialog.getByLabel("Name").fill(customerName);
      await customerDialog.getByLabel("Email").fill(`${marker}-customer@example.com`);
      await customerDialog.getByRole("button", { name: "Save changes" }).click();
      await expect
        .poll(
          async () =>
            prisma.customer.count({
              where: {
                companyId: ownerUser.activeCompanyId,
                name: customerName,
              },
            }),
          { timeout: 10_000 },
        )
        .toBeGreaterThan(0);
      const createdCustomer = await prisma.customer.findFirst({
        where: {
          companyId: ownerUser.activeCompanyId,
          name: customerName,
        },
        select: { id: true },
      });
      expect(createdCustomer?.id).toBeTruthy();
      if (!createdCustomer?.id) {
        throw new Error("Failed to create customer fixture for invoice flow");
      }

      // 5) Create an invoice.
      await page.goto(`/invoices?fresh=${Date.now()}`);
      await page.locator("#add-invoice").click();
      const addInvoiceForm = page.locator('form:has(input[name="number"])').first();
      await expect(addInvoiceForm).toBeVisible();
      await addInvoiceForm.getByPlaceholder("INV-0001").fill(invoiceNumber);
      const customerSelect = addInvoiceForm.locator('select[name="customerId"]');
      await customerSelect.selectOption({ index: 1 });
      await expect(customerSelect).not.toHaveValue("");
      const firstInvoiceLine = addInvoiceForm.locator("div.grid.grid-cols-12").first();
      const lineProductSelect = firstInvoiceLine.locator("select").first();
      await lineProductSelect.selectOption({ index: 1 });
      await expect(firstInvoiceLine.getByPlaceholder("Description")).not.toHaveValue("");
      await addInvoiceForm.getByRole("button", { name: "Create invoice" }).click();
      await expect
        .poll(
          async () =>
            prisma.salesInvoice.count({
              where: {
                companyId: ownerUser.activeCompanyId,
                number: invoiceNumber,
              },
            }),
          { timeout: 10_000 },
        )
        .toBeGreaterThan(0);
    } finally {
      await cleanupByMarker(marker);
    }
  });
});
