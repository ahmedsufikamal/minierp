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
}

async function postInventoryDocumentAction(page: Page, docId: string, action: "SUBMIT" | "APPROVE" | "POST") {
  const response = await page.request.post(`/api/v1/inventory/documents/${docId}/actions`, {
    data: {
      action,
      ...(action === "POST" ? { idempotencyKey: `${docId}-post-${Date.now()}` } : {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
  expect(response.ok(), body.error?.message ?? `action ${action} failed`).toBeTruthy();
  expect(body.ok).toBe(true);
}

async function createAndPostDocument(
  page: Page,
  payload: {
    documentType: "RECEIPT" | "TRANSFER" | "ADJUSTMENT";
    number: string;
    sourceWarehouseId?: string;
    destinationWarehouseId?: string;
    itemId: string;
    quantity: number;
    unitCostMinor: number;
  },
) {
  const response = await page.request.post("/api/v1/inventory/documents", {
    data: {
      documentType: payload.documentType,
      number: payload.number,
      sourceWarehouseId: payload.sourceWarehouseId ?? null,
      destinationWarehouseId: payload.destinationWarehouseId ?? null,
      lines: [
        {
          itemId: payload.itemId,
          quantity: payload.quantity,
          unitCostMinor: payload.unitCostMinor,
          currency: "BDT",
        },
      ],
    },
  });

  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: { id?: string }; error?: { message?: string } };
  expect(response.ok(), body.error?.message ?? "document create failed").toBeTruthy();
  expect(body.ok).toBe(true);
  expect(body.data?.id).toBeTruthy();
  const docId = body.data!.id!;

  await postInventoryDocumentAction(page, docId, "SUBMIT");
  await postInventoryDocumentAction(page, docId, "APPROVE");
  await postInventoryDocumentAction(page, docId, "POST");

  return docId;
}

async function createWarehouse(
  page: Page,
  input: {
    code: string;
    name: string;
  },
) {
  const response = await page.request.post("/api/v1/inventory/warehouses", {
    data: {
      code: input.code,
      name: input.name,
      description: null,
      isActive: true,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: { id?: string };
    error?: { message?: string };
  };
  expect(response.ok(), body.error?.message ?? "warehouse create failed").toBeTruthy();
  expect(body.ok).toBe(true);
  expect(body.data?.id).toBeTruthy();
  return body.data!.id!;
}

async function cleanupInventoryMarker(marker: string) {
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
    await prisma.inventoryAttachment.deleteMany({ where: { companyId: { in: companyIds } } });
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

test.describe("smoke: inventory critical flows", () => {
  test("create item, warehouses, receipt, transfer, adjustment, and verify ledger/balances", async ({ page }) => {
    const marker = `inv-smoke-${Date.now()}`;
    const ownerEmail = `${marker}@example.com`;
    const companySlug = `${marker}-company`;
    const warehouseA = `${marker}-wh-a`;
    const warehouseB = `${marker}-wh-b`;

    try {
      await signUp(page, {
        name: "Inventory Smoke Owner",
        email: ownerEmail,
        companyName: `${marker} Company`,
        companySlug,
      });
      await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);

      const bridgeResult = await page.evaluate(async () => {
        const response = await fetch("/api/auth/session/bridge", { method: "POST" });
        const body = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: { message?: string };
        };
        return {
          ok: response.ok,
          body,
        };
      });
      expect(bridgeResult.ok, bridgeResult.body.error?.message ?? "session bridge failed").toBeTruthy();
      expect(bridgeResult.body.ok).toBe(true);

      const orgsResponse = await page.request.get("/api/orgs");
      const orgsBody = (await orgsResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: Array<{ id: string; isDefault?: boolean }>;
        error?: { message?: string };
      };
      expect(orgsResponse.ok(), orgsBody.error?.message ?? "org fetch failed").toBeTruthy();
      expect(orgsBody.ok).toBe(true);
      const activeCompanyId =
        orgsBody.data?.find((org) => org.isDefault)?.id ??
        orgsBody.data?.[0]?.id ??
        null;
      expect(activeCompanyId).toBeTruthy();
      if (!activeCompanyId) {
        throw new Error("Could not resolve active company");
      }

      const brand = await prisma.brand.create({
        data: {
          companyId: activeCompanyId,
          name: `${marker}-brand`,
        },
        select: { id: true },
      });

      // 1) Create Item
      const createItemResponse = await page.request.post("/api/v1/inventory/items", {
        data: {
          name: `${marker} Item`,
          description: "",
          brandId: brand.id,
          uom: "pcs",
          unitCostMinor: 100,
          priceCents: 100,
          trackSerial: false,
          trackBatch: false,
          lowStockThreshold: 0,
          isActive: true,
          identifiers: [],
          customFields: {},
        },
      });
      const createItemBody = (await createItemResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { id?: string };
        error?: { message?: string };
      };
      expect(createItemResponse.ok(), createItemBody.error?.message ?? "item create failed").toBeTruthy();
      expect(createItemBody.ok).toBe(true);
      const createdItemId = createItemBody.data?.id ?? null;
      expect(createdItemId).toBeTruthy();
      if (!createdItemId) {
        throw new Error("Item was not created");
      }
      await page.goto(`/inventory/items/${createdItemId}`);
      await expect(page).toHaveURL(new RegExp(`/inventory/items/${createdItemId}$`));

      // 2) Create Warehouses
      await createWarehouse(page, { code: warehouseA, name: "Warehouse A" });
      await createWarehouse(page, { code: warehouseB, name: "Warehouse B" });

      await expect
        .poll(
          () =>
            prisma.inventoryWarehouse.findMany({
              where: {
                companyId: activeCompanyId,
                code: { in: [warehouseA, warehouseB] },
              },
              select: { id: true, code: true },
            }),
          { timeout: 15_000 },
        )
        .toHaveLength(2);

      const warehouseRows = await prisma.inventoryWarehouse.findMany({
        where: {
          companyId: activeCompanyId,
          code: { in: [warehouseA, warehouseB] },
        },
        select: { id: true, code: true },
      });
      const sourceWarehouseId = warehouseRows.find((row) => row.code === warehouseA)?.id;
      const destinationWarehouseId = warehouseRows.find((row) => row.code === warehouseB)?.id;
      if (!sourceWarehouseId || !destinationWarehouseId) {
        throw new Error("Warehouses were not created");
      }
      await page.goto("/stock/warehouses");

      // 3) Receive stock
      const receiptId = await createAndPostDocument(page, {
        documentType: "RECEIPT",
        number: `${marker}-rcv`,
        destinationWarehouseId: sourceWarehouseId,
        itemId: createdItemId,
        quantity: 5,
        unitCostMinor: 100,
      });

      // 4) Transfer stock
      const transferId = await createAndPostDocument(page, {
        documentType: "TRANSFER",
        number: `${marker}-xfer`,
        sourceWarehouseId,
        destinationWarehouseId,
        itemId: createdItemId,
        quantity: 2,
        unitCostMinor: 100,
      });

      // 5) Adjustment (negative)
      const adjustmentId = await createAndPostDocument(page, {
        documentType: "ADJUSTMENT",
        number: `${marker}-adj`,
        sourceWarehouseId: destinationWarehouseId,
        itemId: createdItemId,
        quantity: -1,
        unitCostMinor: 100,
      });

      // 6) Ledger and balances verification
      const ledgerResponse = await page.request.get(
        `/api/v1/inventory/ledger?itemId=${encodeURIComponent(createdItemId)}&limit=200`,
      );
      const ledgerBody = (await ledgerResponse.json()) as {
        ok?: boolean;
        data?: { rows?: Array<{ documentId?: string | null }> };
      };
      expect(ledgerResponse.ok()).toBeTruthy();
      expect(ledgerBody.ok).toBe(true);

      const documentIds = new Set((ledgerBody.data?.rows ?? []).map((row) => row.documentId));
      expect(documentIds.has(receiptId)).toBe(true);
      expect(documentIds.has(transferId)).toBe(true);
      expect(documentIds.has(adjustmentId)).toBe(true);

      const [sourceBalance, destinationBalance] = await Promise.all([
        prisma.inventoryStockBalance.findFirst({
          where: {
            companyId: activeCompanyId,
            itemId: createdItemId,
            warehouseId: sourceWarehouseId,
            locationId: null,
          },
          select: { onHand: true },
        }),
        prisma.inventoryStockBalance.findFirst({
          where: {
            companyId: activeCompanyId,
            itemId: createdItemId,
            warehouseId: destinationWarehouseId,
            locationId: null,
          },
          select: { onHand: true },
        }),
      ]);

      expect(sourceBalance?.onHand).toBe(3);
      expect(destinationBalance?.onHand).toBe(1);
    } finally {
      await cleanupInventoryMarker(marker);
    }
  });
});
