"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { handlePrismaUniqueConflict } from "@/lib/prisma-errors";
import { normalizeSku } from "@/domain/inventory/sku";

const ProductSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(2, "Name is required"),
  uom: z.string().min(1, "UOM is required"),
  price: z.string().optional().or(z.literal("")),
  brandId: z.string().optional(),
});

function toCents(input: string | undefined) {
  const val = Number(String(input ?? "0").replace(/,/g, ""));
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100);
}


export async function createProduct(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();

  const parsed = ProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    uom: formData.get("uom"),
    price: formData.get("price"),
    brandId: formData.get("brandId"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const { sku, name, uom, price, brandId } = parsed.data;
  const normalizedSku = normalizeSku(sku);

  try {
    // Get or create brand (default to SIEMENS if not provided)
    let finalBrandId = brandId;
    if (!finalBrandId) {
      try {
        const defaultBrand = await prisma.brand.upsert({
          where: { companyId_name: { companyId, name: "SIEMENS" } },
          create: { companyId, name: "SIEMENS" },
          update: {},
        });
        finalBrandId = defaultBrand.id;
      } catch (error: any) {
        if (error?.code === 'P2021' || error?.code === 'P2022' || error?.message?.includes('does not exist')) {
          return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
        }
        throw error;
      }
    }

    await prisma.product.create({
      data: {
        companyId,
        brandId: finalBrandId,
        sku,
        normalizedSku,
        name,
        uom,
        priceCents: toCents(price),
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2021' || e?.message?.includes('does not exist') || 
        (e?.message?.includes('column') && e?.message?.includes('brandId'))) {
      return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
    }
    if (e?.code === 'P2022' || (e?.message?.includes('column') && e?.message?.includes('brandId'))) {
      return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
    }
    const conflict = handlePrismaUniqueConflict(e, "sku");
    if (conflict) return conflict;
    throw e;
  }

  revalidatePath("/products");
  return { ok: true };
}

export async function updateProduct(id: string, formData: FormData) {
  const companyId = await getCompanyIdOrUserId();

  const parsed = ProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    uom: formData.get("uom"),
    price: formData.get("price"),
    brandId: formData.get("brandId"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.product.findFirst({ where: { id, companyId } });
  if (!existing) return { ok: false, error: "Product not found" };

  const { sku, name, uom, price, brandId } = parsed.data;
  const normalizedSku = normalizeSku(sku);

  try {
    // Get or create brand (default to SIEMENS if not provided)
    let finalBrandId = brandId || existing.brandId;
    if (!finalBrandId) {
      try {
        const defaultBrand = await prisma.brand.upsert({
          where: { companyId_name: { companyId, name: "SIEMENS" } },
          create: { companyId, name: "SIEMENS" },
          update: {},
        });
        finalBrandId = defaultBrand.id;
      } catch (error: any) {
        if (error?.code === 'P2021' || error?.code === 'P2022' || error?.message?.includes('does not exist')) {
          return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
        }
        throw error;
      }
    }

    await prisma.product.update({
      where: { id },
      data: {
        brandId: finalBrandId,
        sku,
        normalizedSku,
        name,
        uom,
        priceCents: toCents(price),
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2021' || e?.message?.includes('does not exist') || 
        (e?.message?.includes('column') && e?.message?.includes('brandId'))) {
      return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
    }
    if (e?.code === 'P2022' || (e?.message?.includes('column') && e?.message?.includes('brandId'))) {
      return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
    }
    const conflict = handlePrismaUniqueConflict(e, "sku");
    if (conflict) return conflict;
    throw e;
  }

  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProduct(id: string) {
  const companyId = await getCompanyIdOrUserId();
  await prisma.product.deleteMany({ where: { id, companyId } });
  revalidatePath("/products");
  return { ok: true };
}
