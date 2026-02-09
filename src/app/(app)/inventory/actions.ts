"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId, getCurrentUser, can } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const MoveSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUST"]),
  qty: z.string().min(1),
  note: z.string().optional().or(z.literal("")),
});

export async function createMove(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return { ok: false, error: "Not authorized to create inventory moves." };
  }

  const parsed = MoveSchema.safeParse({
    productId: formData.get("productId"),
    type: formData.get("type"),
    qty: formData.get("qty"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const qty = Number(parsed.data.qty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: { qty: ["Qty must be a positive number"] } };
  }

  await prisma.inventoryMove.create({
    data: {
      companyId,
      productId: parsed.data.productId,
      type: parsed.data.type,
      qty: Math.round(qty),
      note: parsed.data.note || null,
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMove(id: string) {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return { ok: false, error: "Not authorized to delete inventory moves." };
  }
  await prisma.inventoryMove.deleteMany({ where: { id, companyId } });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}
