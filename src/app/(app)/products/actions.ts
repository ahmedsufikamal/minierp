"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { handlePrismaUniqueConflict } from "@/lib/prisma-errors";
import { normalizeSku } from "@/domain/inventory/sku";
import { PlatformError } from "@/modules/platform/domain/errors";
import { getPlatformContextForServerAction } from "@/modules/platform/application/server-action-context";
import { allocateCompanyRequiredSeriesNumber } from "@/modules/platform/application/company-numbering.service";

const ProductCreateSchema = z.object({
  sku: z.string().trim().optional().or(z.literal("")),
  name: z.string().min(2, "Name is required"),
  uom: z.string().min(1, "UOM is required"),
  price: z.string().optional().or(z.literal("")),
  brandId: z.string().optional(),
});

const ProductUpdateSchema = z.object({
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

function isMissingSchemaError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return (
    e?.code === "P2021" ||
    e?.code === "P2022" ||
    Boolean(e?.message?.includes("does not exist")) ||
    (Boolean(e?.message?.includes("column")) && Boolean(e?.message?.includes("brandId")))
  );
}

export async function createProduct(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();

  const parsed = ProductCreateSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    uom: formData.get("uom"),
    price: formData.get("price"),
    brandId: formData.get("brandId"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const { sku: manualSku, name, uom, price, brandId } = parsed.data;
  if (manualSku?.trim()) {
    return { ok: false, error: { sku: ["SKU is system-generated; manual SKU is not allowed"] } };
  }

  const platformCtx = await getPlatformContextForServerAction();
  let generatedSku: string;
  try {
    const allocated = await allocateCompanyRequiredSeriesNumber(platformCtx, { key: "SKU" });
    generatedSku = allocated.number;
  } catch (error) {
    if (error instanceof PlatformError) {
      return { ok: false, error: { _form: [error.message] } };
    }
    throw error;
  }

  const normalizedSku = normalizeSku(generatedSku);

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
      } catch (error: unknown) {
        if (isMissingSchemaError(error)) {
          return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
        }
        throw error;
      }
    }

    await prisma.product.create({
      data: {
        companyId,
        brandId: finalBrandId,
        sku: generatedSku,
        normalizedSku,
        name,
        uom,
        priceCents: toCents(price),
      },
    });
  } catch (error: unknown) {
    if (isMissingSchemaError(error)) {
      return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
    }
    const conflict = handlePrismaUniqueConflict(error, "sku");
    if (conflict) return conflict;
    throw error;
  }

  revalidatePath("/products");
  return { ok: true };
}

export async function updateProduct(id: string, formData: FormData) {
  const companyId = await getCompanyIdOrUserId();

  const parsed = ProductUpdateSchema.safeParse({
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
      } catch (error: unknown) {
        if (isMissingSchemaError(error)) {
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
  } catch (error: unknown) {
    if (isMissingSchemaError(error)) {
      return { ok: false, error: { _form: ["Database migration required. Please run: npx prisma migrate dev"] } };
    }
    const conflict = handlePrismaUniqueConflict(error, "sku");
    if (conflict) return conflict;
    throw error;
  }

  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProduct(id: string) {
  const companyId = await getCompanyIdOrUserId();
  const result = await prisma.product.deleteMany({ where: { id, companyId } });
  if (result.count === 0) {
    return { ok: false, error: "Product not found" };
  }
  revalidatePath("/products");
  return { ok: true };
}
