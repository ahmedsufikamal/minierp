"use server";

import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const LineSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  unitPriceCents: z.coerce.number().int().nonnegative(),
});

const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  number: z.string().min(1),
  // UI might send issueDate; schema uses invoiceDate
  issueDate: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  linesJson: z.string().min(2), // required
});

function toDateOrUndefined(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function createInvoice(formData: FormData): Promise<void> {
  const orgId = await getOrgIdOrUserId();

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
    throw new Error("Invalid invoice form data");
  }

  const { customerId, number, issueDate, invoiceDate, dueDate, notes, linesJson } = parsed.data;

  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(linesJson);
  } catch {
    throw new Error("Invalid lines JSON");
  }

  const lines = z.array(LineSchema).parse(linesRaw);
  if (lines.length === 0) throw new Error("Invoice must have at least 1 line");

  const invoiceDateValue =
    toDateOrUndefined(issueDate) ??
    toDateOrUndefined(invoiceDate) ??
    new Date();

  const dueDateValue = toDateOrUndefined(dueDate);

  await prisma.salesInvoice.create({
    data: {
      orgId,
      customerId,
      number,
      invoiceDate: invoiceDateValue,     // ✅ schema field
      dueDate: dueDateValue ?? null,
      notes: notes?.trim() ? notes.trim() : null,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          // NOTE: schema does NOT have lineTotalCents, so we don't write it
        })),
      },
    },
  });

  revalidatePath("/invoices");
}

export async function deleteInvoice(id: string): Promise<void> {
  const orgId = await getOrgIdOrUserId();

  const inv = await prisma.salesInvoice.findFirst({
    where: { id, orgId },
    select: { id: true },
  });

  if (!inv) throw new Error("Invoice not found");

  await prisma.salesInvoice.delete({ where: { id } });
  revalidatePath("/invoices");
}
