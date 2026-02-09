"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId, getCurrentUser, can } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createCategory(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return { ok: false, error: "Not authorized to create categories." };
  }
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  await prisma.category.upsert({
    where: { companyId_name: { companyId, name } },
    create: { companyId, name },
    update: {},
  });
  revalidatePath("/inventory/categories");
  return { ok: true };
}

export async function deleteCategory(id: string) {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return { ok: false, error: "Not authorized to delete categories." };
  }
  await prisma.category.deleteMany({ where: { id, companyId } });
  revalidatePath("/inventory/categories");
  return { ok: true };
}
