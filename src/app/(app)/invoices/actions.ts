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

const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  number: z.string().min(1),
  issueDate: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  linesJson: z.string().min(2),
});

function toDateOrUndefined(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function createInvoice(formData: FormData): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();

  const parsed = CreateInvoiceSchema.safeParse({
    customerId: formData.get("customerId"),
    number: formData.get("number"),
    issueDate: formData.get("issueDate"),
    invoiceDate: formData.get("invoiceDate"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes"),
    linesJson: formData.get("linesJson"),
  });

  if (!parsed.success) {
    return failure(parsed.error.flatten().fieldErrors);
  }

  const { customerId, number, issueDate, invoiceDate, dueDate, notes, linesJson } = parsed.data;

  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(linesJson);
  } catch {
    return failure({ linesJson: ["Invalid line items JSON"] });
  }

  const linesResult = z.array(LineSchema).safeParse(linesRaw);
  if (!linesResult.success) {
    return failure({ lines: ["Invalid line items"] });
  }
  const lines = linesResult.data;
  if (lines.length === 0) {
    return failure({ lines: ["Invoice must have at least 1 line"] });
  }

  const invoiceDateValue =
    toDateOrUndefined(issueDate) ?? toDateOrUndefined(invoiceDate) ?? new Date();
  const dueDateValue = toDateOrUndefined(dueDate);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.salesInvoice.create({
        data: {
          companyId,
          customerId,
          number,
          invoiceDate: invoiceDateValue,
          dueDate: dueDateValue ?? null,
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

  revalidatePath("/invoices");
  return success();
}

const InvoiceStatuses = ["DRAFT", "SENT", "PAID", "VOID"] as const;

export async function updateInvoiceStatus(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();
  const status = formData.get("status");
  const parsed = z.enum(InvoiceStatuses).safeParse(status);
  if (!parsed.success) return failure("Invalid status");

  const inv = await prisma.salesInvoice.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });
  if (!inv) return failure("Invoice not found");

  await prisma.salesInvoice.update({
    where: { id },
    data: { status: parsed.data },
  });
  revalidatePath("/invoices");
  return success();
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();

  const inv = await prisma.salesInvoice.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!inv) return failure("Invoice not found");

  await prisma.salesInvoice.delete({ where: { id } });
  revalidatePath("/invoices");
  return success();
}
