"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId, getCurrentUser, can } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createBrand(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return { ok: false, error: "Not authorized to create brands." };
  }
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  await prisma.brand.upsert({
    where: { companyId_name: { companyId, name } },
    create: { companyId, name },
    update: {},
  });
  revalidatePath("/inventory/brands");
  return { ok: true };
}

export async function deleteBrand(id: string) {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return { ok: false, error: "Not authorized to delete brands." };
  }
  await prisma.brand.deleteMany({ where: { id, companyId } });
  revalidatePath("/inventory/brands");
  return { ok: true };
}
