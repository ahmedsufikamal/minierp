"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { success, failure } from "@/lib/action-result";
import { handlePrismaUniqueConflict } from "@/lib/prisma-errors";

const LineSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  unitPriceCents: z.coerce.number().int().nonnegative(),
});

const CreateQuoteSchema = z.object({
  customerId: z.string().min(1),
  number: z.string().min(1),
  quoteDate: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  linesJson: z.string().min(2),
});

const QuoteStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

function toDateOrUndefined(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function createQuote(formData: FormData): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();

  const parsed = CreateQuoteSchema.safeParse({
    customerId: formData.get("customerId"),
    number: formData.get("number"),
    quoteDate: formData.get("quoteDate"),
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes"),
    linesJson: formData.get("linesJson"),
  });

  if (!parsed.success) return failure(parsed.error.flatten().fieldErrors);

  const { customerId, number, quoteDate, validUntil, notes, linesJson } = parsed.data;

  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(linesJson);
  } catch {
    return failure({ linesJson: ["Invalid line items JSON"] });
  }

  const linesResult = z.array(LineSchema).safeParse(linesRaw);
  if (!linesResult.success) return failure({ lines: ["Invalid line items"] });
  const lines = linesResult.data;
  if (lines.length === 0) return failure({ lines: ["Quote must have at least 1 line"] });

  const quoteDateValue = toDateOrUndefined(quoteDate) ?? new Date();
  const validUntilValue = toDateOrUndefined(validUntil);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quote.create({
        data: {
          companyId,
          customerId,
          number,
          quoteDate: quoteDateValue,
          validUntil: validUntilValue ?? null,
          notes: notes?.trim() ? notes.trim() : null,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId || null,
              description: l.description,
              qty: l.qty,
              unitPriceCents: l.unitPriceCents,
            })),
          },
        },
      });
    });
  } catch (e) {
    const conflict = handlePrismaUniqueConflict(e, "number");
    if (conflict) return conflict;
    throw e;
  }

  revalidatePath("/quotes");
  return success();
}

export async function updateQuoteStatus(id: string, formData: FormData): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();
  const status = formData.get("status");
  const parsed = z.enum(QuoteStatuses).safeParse(status);
  if (!parsed.success) return failure("Invalid status");

  const quote = await prisma.quote.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!quote) return failure("Quote not found");

  await prisma.quote.update({
    where: { id },
    data: { status: parsed.data },
  });
  revalidatePath("/quotes");
  return success();
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();
  const quote = await prisma.quote.findFirst({
    where: { id, companyId },
    select: { id: true, convertedToInvoiceId: true },
  });
  if (!quote) return failure("Quote not found");
  if (quote.convertedToInvoiceId) return failure("Cannot delete a quote that was converted to an invoice");

  await prisma.quote.delete({ where: { id } });
  revalidatePath("/quotes");
  return success();
}

export async function convertQuoteToInvoice(quoteId: string, invoiceNumber: string): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId },
    include: { lines: true },
  });
  if (!quote) return failure("Quote not found");
  if (quote.convertedToInvoiceId) return failure("Quote already converted to an invoice");
  if (quote.status !== "ACCEPTED" && quote.status !== "DRAFT") {
    return failure("Only DRAFT or ACCEPTED quotes can be converted");
  }

  const existingInv = await prisma.salesInvoice.findFirst({
    where: { companyId, number: invoiceNumber },
  });
  if (existingInv) return failure("Invoice number already exists");

  await prisma.$transaction(async (tx) => {
    const inv = await tx.salesInvoice.create({
      data: {
        companyId,
        customerId: quote.customerId,
        number: invoiceNumber,
        invoiceDate: quote.quoteDate,
        notes: quote.notes,
        status: "DRAFT",
        lines: {
          create: quote.lines.map((l) => ({
            productId: l.productId,
            description: l.description,
            qty: l.qty,
            unitPriceCents: l.unitPriceCents,
          })),
        },
      },
    });
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: "ACCEPTED", convertedToInvoiceId: inv.id },
    });
  });

  revalidatePath("/quotes");
  revalidatePath("/invoices");
  return success();
}
