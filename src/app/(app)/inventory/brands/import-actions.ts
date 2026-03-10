"use server";

import { revalidatePath } from "next/cache";
import { authorizeServerActionPermission } from "@/lib/auth";
import {
  brandImportAcceptedRowsSchema,
  commitBrandImportRows,
  previewBrandImportFile,
  type BrandImportAcceptedRow,
  type BrandImportCommitResult,
  type BrandImportPreview,
} from "@/modules/inventory/application/brand-import.service";

export async function previewBrandImport(
  formData: FormData,
): Promise<{ ok: true; data: BrandImportPreview } | { ok: false; error: string }> {
  const auth = await authorizeServerActionPermission({
    iamPermission: "inventory.import.read",
    legacyPermission: "inventory:read",
  });
  if (!auth.allowed || !auth.context) {
    return { ok: false, error: "Not authorized to preview brand imports." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }

  try {
    return await previewBrandImportFile({
      companyId: auth.context.companyId,
      file,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to preview the brand import.",
    };
  }
}

export async function commitBrandImport(
  rows: BrandImportAcceptedRow[],
): Promise<{ ok: true; data: BrandImportCommitResult } | { ok: false; error: string }> {
  const auth = await authorizeServerActionPermission({
    iamPermission: "inventory.import.write",
    legacyPermission: "inventory:write",
  });
  if (!auth.allowed || !auth.context) {
    return { ok: false, error: "Not authorized to import brands." };
  }

  const parsedRows = brandImportAcceptedRowsSchema.safeParse(rows);
  if (!parsedRows.success) {
    return { ok: false, error: "Invalid brand import payload." };
  }

  try {
    const result = await commitBrandImportRows({
      companyId: auth.context.companyId,
      rows: parsedRows.data,
    });

    revalidatePath("/inventory/brands");
    revalidatePath("/stock/setup/brand");

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to import brands.",
    };
  }
}
