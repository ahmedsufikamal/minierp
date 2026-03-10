"use server";

import { prisma } from "@/lib/prisma";
import { authorizeServerActionPermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createBrand(formData: FormData) {
  const auth = await authorizeServerActionPermission({
    iamPermission: "inventory.write",
    legacyPermission: "inventory:write",
  });
  if (!auth.allowed || !auth.context) {
    return;
  }
  const { companyId } = auth.context;
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.brand.upsert({
    where: { companyId_name: { companyId, name } },
    create: { companyId, name },
    update: {},
  });
  revalidatePath("/inventory/brands");
  revalidatePath("/stock/setup/brand");
  return;
}

export async function deleteBrand(id: string) {
  const auth = await authorizeServerActionPermission({
    iamPermission: "inventory.write",
    legacyPermission: "inventory:write",
  });
  if (!auth.allowed || !auth.context) {
    return;
  }
  const { companyId } = auth.context;
  await prisma.brand.deleteMany({ where: { id, companyId } });
  revalidatePath("/inventory/brands");
  revalidatePath("/stock/setup/brand");
  return;
}
