"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId, getCurrentUser, can } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createCategory(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return;
  }
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.category.upsert({
    where: { companyId_name: { companyId, name } },
    create: { companyId, name },
    update: {},
  });
  revalidatePath("/inventory/categories");
  return;
}

export async function deleteCategory(id: string) {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return;
  }
  await prisma.category.deleteMany({ where: { id, companyId } });
  revalidatePath("/inventory/categories");
  return;
}
