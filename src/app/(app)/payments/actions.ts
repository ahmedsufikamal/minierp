"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { success, failure } from "@/lib/action-result";

const CreatePaymentSchema = z.object({
  type: z.enum(["INBOUND", "OUTBOUND"]),
  amount: z.string().min(1),
  date: z.string().min(1),
  reference: z.string().optional().or(z.literal("")),
  method: z.enum(["CASH", "BANK", "CARD", "OTHER"]),
  invoiceId: z.string().optional().or(z.literal("")),
  billId: z.string().optional().or(z.literal("")),
});

export async function createPayment(formData: FormData): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();

  const parsed = CreatePaymentSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    reference: formData.get("reference"),
    method: formData.get("method"),
    invoiceId: formData.get("invoiceId"),
    billId: formData.get("billId"),
  });

  if (!parsed.success) return failure(parsed.error.flatten().fieldErrors);

  const amountNum = parseFloat(parsed.data.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) return failure({ amount: ["Invalid amount"] });
  const amountCents = Math.round(amountNum * 100);

  const { type, date, reference, method, invoiceId, billId } = parsed.data;
  const invoiceIdVal = invoiceId && invoiceId.trim() ? invoiceId.trim() : null;
  const billIdVal = billId && billId.trim() ? billId.trim() : null;

  if (invoiceIdVal && billIdVal) return failure("Link to either an invoice or a bill, not both");
  if (!invoiceIdVal && !billIdVal) return failure("Link to an invoice or a bill");

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return failure({ date: ["Invalid date"] });

  if (invoiceIdVal) {
    const inv = await prisma.salesInvoice.findFirst({
      where: { id: invoiceIdVal, companyId },
      include: { lines: true },
    });
    if (!inv) return failure("Invoice not found");
    if (type !== "INBOUND") return failure("Invoice payments must be INBOUND");
  }

  if (billIdVal) {
    const bill = await prisma.purchaseBill.findFirst({
      where: { id: billIdVal, companyId },
      include: { lines: true },
    });
    if (!bill) return failure("Bill not found");
    if (type !== "OUTBOUND") return failure("Bill payments must be OUTBOUND");
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        companyId,
        type: type as "INBOUND" | "OUTBOUND",
        amountCents,
        date: dateObj,
        reference: reference?.trim() || null,
        method: method as "CASH" | "BANK" | "CARD" | "OTHER",
        invoiceId: invoiceIdVal,
        billId: billIdVal,
      },
    });

    if (invoiceIdVal) {
      const totalPaid = await tx.payment.aggregate({
        where: { invoiceId: invoiceIdVal },
        _sum: { amountCents: true },
      });
      const inv = await tx.salesInvoice.findFirst({
        where: { id: invoiceIdVal },
        include: { lines: true },
      });
      if (inv) {
        const total = inv.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
        if ((totalPaid._sum.amountCents ?? 0) >= total) {
          await tx.salesInvoice.update({
            where: { id: invoiceIdVal },
            data: { status: "PAID" },
          });
        }
      }
    }

    if (billIdVal) {
      const totalPaid = await tx.payment.aggregate({
        where: { billId: billIdVal },
        _sum: { amountCents: true },
      });
      const bill = await tx.purchaseBill.findFirst({
        where: { id: billIdVal },
        include: { lines: true },
      });
      if (bill) {
        const total = bill.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
        if ((totalPaid._sum.amountCents ?? 0) >= total) {
          await tx.purchaseBill.update({
            where: { id: billIdVal },
            data: { status: "PAID" },
          });
        }
      }
    }
  });

  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/bills");
  return success();
}
