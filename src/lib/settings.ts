import "server-only";
import { prisma } from "@/lib/prisma";

export async function getOrgSettings(companyId: string): Promise<Record<string, string>> {
  const rows = await prisma.orgSetting.findMany({
    where: { companyId },
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setOrgSetting(
  companyId: string,
  key: string,
  value: string,
): Promise<void> {
  await prisma.orgSetting.upsert({
    where: {
      companyId_key: { companyId, key },
    },
    create: { companyId, key, value },
    update: { value },
  });
}
