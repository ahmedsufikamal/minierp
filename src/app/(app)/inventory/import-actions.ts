"use server";

import { getCompanyIdOrUserId, getCurrentUser, can } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { previewImport, executeImport } from "@/application/inventory/import-service";
import type { ImportPreview } from "@/application/inventory/dtos";

/**
 * Preview Excel import without committing
 */
export async function previewExcelImport(
  formData: FormData
): Promise<{ ok: boolean; data?: ImportPreview; error?: string }> {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:read")) {
    return { ok: false, error: "Not authorized to preview inventory imports." };
  }

  const file = formData.get("file") as File | null;
  const brandOverride = formData.get("brandOverride") as string | null;
  const mode = (formData.get("mode") as "OPENING_ONLY" | "HISTORY_APPROX" | null) ?? "OPENING_ONLY";

  if (!file) {
    return { ok: false, error: "No file provided" };
  }

  try {
    const result = await previewImport({
      companyId,
      file,
      brandOverride,
      mode,
      actorId: user.id,
    });
    return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
  } catch (error) {
    console.error("Preview import error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to parse Excel file",
    };
  }
}

/**
 * Execute the import
 */
export async function executeExcelImport(
  formData: FormData
): Promise<{ ok: boolean; error?: string; snapshotId?: string }> {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory:write")) {
    return { ok: false, error: "Not authorized to execute inventory imports." };
  }
  
  const file = formData.get("file") as File | null;
  const brandOverride = formData.get("brandOverride") as string | null;
  const forceReimport = formData.get("forceReimport") === "true";
  const mode = (formData.get("mode") as "OPENING_ONLY" | "HISTORY_APPROX" | null) ?? "OPENING_ONLY";
  
  if (!file) {
    return { ok: false, error: "No file provided" };
  }

  const result = await executeImport({
    companyId,
    file,
    brandOverride,
    forceReimport,
    mode,
    actorId: user.id,
  });
  if (result.ok) {
    revalidatePath("/inventory");
    revalidatePath("/inventory/import");
    revalidatePath("/inventory/items");
    revalidatePath("/inventory/locations");
    revalidatePath("/inventory/snapshots");
    return { ok: true, snapshotId: result.snapshotId };
  }
  return { ok: false, error: result.error };
}
