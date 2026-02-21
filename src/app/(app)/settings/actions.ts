"use server";

import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { setOrgSetting } from "@/lib/settings";
import type { ActionResult } from "@/lib/action-result";
import { success, failure } from "@/lib/action-result";
import { z } from "zod";

const SettingsSchema = z.object({
  orgName: z.string().optional(),
  defaultCurrency: z.string().optional(),
  taxRate: z.string().optional(),
});

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();
  const parsed = SettingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return failure(parsed.error.flatten().fieldErrors);

  const d = parsed.data;
  const entries: [string, string][] = [
    ["orgName", d.orgName ?? ""],
    ["defaultCurrency", d.defaultCurrency ?? "BDT"],
    ["taxRate", d.taxRate ?? ""],
  ];

  for (const [key, value] of entries) {
    await setOrgSetting(companyId, key, value);
  }

  revalidatePath("/settings");
  return success();
}
