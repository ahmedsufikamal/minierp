"use server";

import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProductSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(2, "Name is required"),
  unit: z.string().min(1, "Unit is required"),
  price: z.string().optional().or(z.literal("")),
});

function toCents(input: string | undefined) {
  const val = Number(String(input ?? "0").replace(/,/g, ""));
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100);
}

export async function createProduct(formData: FormData) {
  const orgId = await getOrgIdOrUserId();

  const parsed = ProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    unit: formData.get("unit"),
    price: formData.get("price"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const { sku, name, unit, price } = parsed.data;

  await prisma.product.create({
    data: {
      orgId,
      sku,
      name,
      unit,
      priceCents: toCents(price),
    },
  });

  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProduct(id: string) {
  const orgId = await getOrgIdOrUserId();
  await prisma.product.deleteMany({ where: { id, orgId } });
  revalidatePath("/products");
  return { ok: true };
}
