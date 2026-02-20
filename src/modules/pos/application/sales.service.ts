import { PaymentMethod, PaymentType, PosSaleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyInventoryDocumentAction,
  createInventoryDocument,
} from "@/modules/inventory/application/documents.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  posSaleActionSchema,
  posSaleCreateSchema,
  posSaleListQuerySchema,
} from "@/modules/pos/domain/schemas";

type SaleAction = "PAY" | "VOID";

type PosSaleWithRelations = Prisma.PosSaleGetPayload<{
  include: {
    profile: true;
    shift: true;
    lines: true;
    payments: true;
  };
}>;

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function toInventoryContext(ctx: PlatformRequestContext): InventoryRequestContext {
  return {
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    userId: ctx.userId,
    role: "COMPANY_ADMIN",
    iamPermissions: ctx.permissions,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  };
}

function mapPosPaymentMethod(method: "CASH" | "CARD" | "BANK" | "WALLET"): PaymentMethod {
  switch (method) {
    case "CASH":
      return PaymentMethod.CASH;
    case "CARD":
      return PaymentMethod.CARD;
    case "BANK":
      return PaymentMethod.BANK;
    case "WALLET":
      return PaymentMethod.OTHER;
  }
}

function assertTransition(current: PosSaleStatus, action: SaleAction): void {
  const allowed: Record<SaleAction, PosSaleStatus[]> = {
    PAY: [PosSaleStatus.DRAFT],
    VOID: [PosSaleStatus.DRAFT],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} POS sale from ${current}`);
  }
}

function computeTotal(lines: Array<{ qty: number; unitPriceMinor: number }>): number {
  return lines.reduce((sum, line) => sum + line.qty * line.unitPriceMinor, 0);
}

async function assertProfile(
  companyId: string,
  profileId: string,
): Promise<{ id: string; warehouseId: string | null; isActive: boolean }> {
  const profile = await prisma.posProfile.findFirst({
    where: { id: profileId, companyId },
    select: { id: true, warehouseId: true, isActive: true },
  });

  if (!profile) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid profileId for this company");
  }

  return profile;
}

async function assertShift(
  companyId: string,
  shiftId: string | null | undefined,
  profileId: string,
): Promise<void> {
  if (!shiftId) return;

  const shift = await prisma.posShift.findFirst({
    where: { id: shiftId, companyId, profileId },
    select: { id: true },
  });

  if (!shift) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid shiftId for this company/profile");
  }
}

async function assertCustomer(
  companyId: string,
  customerId: string | null | undefined,
): Promise<void> {
  if (!customerId) return;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });

  if (!customer) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid customerId for this company");
  }
}

async function assertProducts(companyId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;

  const uniqueIds = [...new Set(productIds)];
  const count = await prisma.product.count({
    where: {
      id: { in: uniqueIds },
      companyId,
    },
  });

  if (count !== uniqueIds.length) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "One or more productId values are invalid for this company",
    );
  }
}

async function postPosSaleInventory(
  inventoryCtx: InventoryRequestContext,
  sale: PosSaleWithRelations,
  warehouseId: string,
): Promise<void> {
  const inventoryDocument = await createInventoryDocument(inventoryCtx, {
    documentType: "ISSUE",
    number: `${sale.number}-ISSUE`,
    sourceWarehouseId: warehouseId,
    documentDate: sale.saleDate,
    externalRef: sale.number,
    notes: `POS Sale ${sale.number}`,
    lines: sale.lines.map((line) => {
      if (!line.productId) {
        throw new PlatformError(
          "VALIDATION_ERROR",
          `POS sale line ${line.lineNo} is missing productId`,
        );
      }

      return {
        itemId: line.productId,
        description: line.description,
        quantity: line.qty,
        unitCostMinor: line.unitPriceMinor,
        currency: sale.currency,
        sourceWarehouseId: warehouseId,
      };
    }),
  });

  await applyInventoryDocumentAction(inventoryCtx, inventoryDocument.id, { action: "SUBMIT" });
  await applyInventoryDocumentAction(inventoryCtx, inventoryDocument.id, { action: "APPROVE" });
  await applyInventoryDocumentAction(inventoryCtx, inventoryDocument.id, {
    action: "POST",
    idempotencyKey: crypto.randomUUID(),
  });
}

export async function listPosSales(ctx: PlatformRequestContext, input: unknown) {
  const parsed = posSaleListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid POS sale query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.PosSaleWhereInput = {
    companyId: ctx.companyId,
    ...(q.profileId ? { profileId: q.profileId } : {}),
    ...(q.shiftId ? { shiftId: q.shiftId } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.posSale.findMany({
      where,
      include: {
        profile: { select: { id: true, name: true } },
        shift: { select: { id: true, number: true, status: true } },
        customer: { select: { id: true, name: true } },
        salesInvoice: { select: { id: true, number: true, status: true } },
        lines: { orderBy: [{ lineNo: "asc" }] },
        payments: true,
      },
      orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.posSale.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createPosSale(ctx: PlatformRequestContext, input: unknown) {
  const parsed = posSaleCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid POS sale payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const profile = await assertProfile(ctx.companyId, payload.profileId);
  if (!profile.isActive) {
    throw new PlatformError("CONFLICT", "Cannot create sale for inactive POS profile");
  }

  await Promise.all([
    assertShift(ctx.companyId, payload.shiftId, payload.profileId),
    assertCustomer(ctx.companyId, payload.customerId),
    assertProducts(
      ctx.companyId,
      payload.lines.map((line) => line.productId).filter((id): id is string => Boolean(id)),
    ),
  ]);

  const totalAmountMinor = computeTotal(payload.lines);

  try {
    return await prisma.posSale.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        profileId: payload.profileId,
        shiftId: payload.shiftId,
        status: PosSaleStatus.DRAFT,
        customerId: payload.customerId,
        saleDate: payload.saleDate ?? new Date(),
        totalAmountMinor,
        currency: payload.currency,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        lines: {
          create: payload.lines.map((line, index) => ({
            lineNo: index + 1,
            productId: line.productId,
            description: line.description,
            qty: line.qty,
            unitPriceMinor: line.unitPriceMinor,
          })),
        },
      },
      include: {
        profile: { select: { id: true, name: true, warehouseId: true } },
        shift: { select: { id: true, number: true, status: true } },
        customer: { select: { id: true, name: true } },
        lines: { orderBy: [{ lineNo: "asc" }] },
        payments: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "POS sale number already exists for this company");
    }
    throw error;
  }
}

export async function applyPosSaleAction(
  ctx: PlatformRequestContext,
  saleId: string,
  input: unknown,
) {
  const parsed = posSaleActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid POS sale action payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  const sale = await prisma.posSale.findFirst({
    where: { id: saleId, companyId: ctx.companyId },
    include: {
      profile: true,
      shift: true,
      lines: { orderBy: [{ lineNo: "asc" }] },
      payments: true,
    },
  });

  if (!sale) {
    throw new PlatformError("NOT_FOUND", "POS sale not found");
  }

  assertTransition(sale.status, payload.action);

  if (payload.action === "VOID") {
    await prisma.posSale.update({
      where: { id: sale.id },
      data: {
        status: PosSaleStatus.VOIDED,
        voidedAt: new Date(),
        notes: payload.note ? [sale.notes, payload.note].filter(Boolean).join("\n") : sale.notes,
        updatedBy: ctx.userId,
      },
    });

    return prisma.posSale.findUniqueOrThrow({
      where: { id: sale.id },
      include: {
        profile: { select: { id: true, name: true, warehouseId: true } },
        shift: { select: { id: true, number: true, status: true } },
        customer: { select: { id: true, name: true } },
        salesInvoice: { select: { id: true, number: true, status: true } },
        lines: { orderBy: [{ lineNo: "asc" }] },
        payments: true,
      },
    });
  }

  if (!sale.customerId) {
    throw new PlatformError("VALIDATION_ERROR", "customerId is required before paying a POS sale");
  }

  if (!sale.profile.warehouseId) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "POS profile must be linked to a warehouse before payment",
    );
  }

  if (sale.shiftId && sale.shift?.status !== "OPEN") {
    throw new PlatformError("CONFLICT", "Linked shift must be OPEN to pay a sale");
  }

  if (sale.lines.length === 0) {
    throw new PlatformError("VALIDATION_ERROR", "POS sale has no lines");
  }

  const payments = payload.payments ?? [];
  if (payments.length === 0) {
    throw new PlatformError("VALIDATION_ERROR", "payments are required for PAY action");
  }

  const paymentTotal = payments.reduce((sum, entry) => sum + entry.amountMinor, 0);
  if (paymentTotal !== sale.totalAmountMinor) {
    throw new PlatformError("VALIDATION_ERROR", "Payment total must match sale totalAmountMinor");
  }

  await assertProducts(
    ctx.companyId,
    sale.lines.map((line) => line.productId).filter((id): id is string => Boolean(id)),
  );

  const inventoryCtx = toInventoryContext(ctx);
  await postPosSaleInventory(inventoryCtx, sale, sale.profile.warehouseId);

  await prisma.$transaction(async (tx) => {
    const invoice = sale.salesInvoiceId
      ? await tx.salesInvoice.findUnique({ where: { id: sale.salesInvoiceId } })
      : await tx.salesInvoice.create({
          data: {
            companyId: ctx.companyId,
            number: `${sale.number}-INV`,
            customerId: sale.customerId!,
            invoiceDate: sale.saleDate,
            notes: `Generated from POS sale ${sale.number}`,
            lines: {
              create: sale.lines.map((line) => ({
                productId: line.productId,
                description: line.description,
                qty: line.qty,
                unitPriceCents: line.unitPriceMinor,
              })),
            },
          },
        });

    if (!invoice) {
      throw new PlatformError("INTERNAL_ERROR", "Failed to create POS sales invoice");
    }

    await tx.posSalePayment.createMany({
      data: payments.map((payment) => ({
        saleId: sale.id,
        method: payment.method,
        amountMinor: payment.amountMinor,
        referenceNo: payment.referenceNo,
      })),
    });

    await tx.payment.createMany({
      data: payments.map((payment) => ({
        companyId: ctx.companyId,
        type: PaymentType.INBOUND,
        amountCents: payment.amountMinor,
        method: mapPosPaymentMethod(payment.method),
        reference: payment.referenceNo,
        invoiceId: invoice.id,
      })),
    });

    await tx.posSale.update({
      where: { id: sale.id },
      data: {
        status: PosSaleStatus.PAID,
        paidAt: new Date(),
        salesInvoiceId: invoice.id,
        notes: payload.note ? [sale.notes, payload.note].filter(Boolean).join("\n") : sale.notes,
        updatedBy: ctx.userId,
      },
    });
  });

  return prisma.posSale.findUniqueOrThrow({
    where: { id: sale.id },
    include: {
      profile: { select: { id: true, name: true, warehouseId: true } },
      shift: { select: { id: true, number: true, status: true } },
      customer: { select: { id: true, name: true } },
      salesInvoice: { select: { id: true, number: true, status: true } },
      lines: { orderBy: [{ lineNo: "asc" }] },
      payments: true,
    },
  });
}
