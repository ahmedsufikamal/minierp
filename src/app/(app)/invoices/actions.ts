"use server";

import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const LineSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1),
  qty: z.number().int().positive(),
  unitPriceCents: z.number().int().min(0),
});

const InvoiceSchema = z.object({
  number: z.string().min(1),
  customerId: z.string().min(1),
  issueDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  linesJson: z.string().min(2),
});

function parseDate(s?: string | null) {
  if (!s) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return d;
}

export async function createInvoice(formData: FormData) {
  const orgId = await getOrgIdOrUserId();

  const parsed = InvoiceSchema.safeParse({
    number: formData.get("number"),
    customerId: formData.get("customerId"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes"),
    linesJson: formData.get("linesJson"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const { number, customerId, issueDate, dueDate, notes, linesJson } =
    parsed.data;

  let rawLines: unknown;
  try {
    rawLines = JSON.parse(linesJson);
  } catch {
    return { ok: false, error: { linesJson: ["Invalid line items JSON"] } };
  }

  const linesParsed = z.array(LineSchema).min(1).safeParse(rawLines);
  if (!linesParsed.success) {
    return { ok: false, error: { lines: ["Invalid line items"] } };
  }

  const lines = linesParsed.data.map((l) => ({
    productId: l.productId || null,
    description: l.description,
    qty: l.qty,
    unitPriceCents: l.unitPriceCents,
    lineTotalCents: l.qty * l.unitPriceCents,
  }));

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const taxCents = 0;
  const totalCents = subtotalCents + taxCents;

  await prisma.salesInvoice.create({
    data: {
      orgId,
      customerId,
      number,
      issueDate: parseDate(issueDate) ?? new Date(),
      dueDate: parseDate(dueDate),
      notes: notes || null,
      subtotalCents,
      taxCents,
      totalCents,
      lines: {
        create: lines,
      },
    },
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteInvoice(id: string) {
  const orgId = await getOrgIdOrUserId();
  await prisma.salesInvoice.deleteMany({ where: { id, orgId } });
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true };
}
