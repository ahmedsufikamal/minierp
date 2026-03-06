import { NumberSeriesResetPolicy } from "@prisma/client";
import { disconnectPrisma, prisma } from "./prisma-client.mjs";

const requiredFormats = [
  {
    key: "SKU",
    name: "SKU Number Format",
    defaultPattern: "SKU-{COMP}-{####}",
    defaultResetPolicy: NumberSeriesResetPolicy.NEVER,
    defaultStartAt: 1,
    defaultPadding: 4,
  },
  {
    key: "QUOTATION",
    name: "Quotation Code",
    defaultPattern: "QTN-{FY}-{COMP}-{####}",
    defaultResetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    defaultStartAt: 1,
    defaultPadding: 4,
    legacyPrefixKey: "quotePrefix",
    legacyNextKey: "quoteNext",
  },
  {
    key: "DELIVERY_CHALLAN",
    name: "Delivery Challan Code",
    defaultPattern: "DCH-{FY}-{COMP}-{####}",
    defaultResetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    defaultStartAt: 1,
    defaultPadding: 4,
  },
  {
    key: "INVOICE",
    name: "Invoice Code",
    defaultPattern: "INV-{FY}-{COMP}-{####}",
    defaultResetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    defaultStartAt: 1,
    defaultPadding: 4,
    legacyPrefixKey: "invoicePrefix",
    legacyNextKey: "invoiceNext",
  },
  {
    key: "SPOT_SALE",
    name: "Spot Sale Code",
    defaultPattern: "POS-{FY}-{COMP}-{####}",
    defaultResetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    defaultStartAt: 1,
    defaultPadding: 4,
  },
  {
    key: "BUDGETARY",
    name: "Budgetary Code",
    defaultPattern: "BGT-{FY}-{COMP}-{####}",
    defaultResetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    defaultStartAt: 1,
    defaultPadding: 4,
  },
];

function parseStartAt(raw, fallback) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function buildPatternFromPrefix(prefix, resetPolicy, fallback) {
  const trimmed = String(prefix ?? "").trim();
  if (!trimmed) return fallback;

  const normalized = trimmed.endsWith("-") ? trimmed.slice(0, -1) : trimmed;
  if (!normalized) return fallback;

  if (resetPolicy === NumberSeriesResetPolicy.FISCAL_YEAR) {
    return `${normalized}-{FY}-{COMP}-{####}`;
  }
  return `${normalized}-{COMP}-{####}`;
}

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, tenantId: true },
  });

  let created = 0;
  let updated = 0;

  for (const company of companies) {
    const tenantId = company.tenantId ?? company.id;
    const settingsRows = await prisma.orgSetting.findMany({
      where: {
        companyId: company.id,
        key: { in: ["invoicePrefix", "invoiceNext", "quotePrefix", "quoteNext"] },
      },
      select: { key: true, value: true },
    });
    const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));

    for (const format of requiredFormats) {
      const pattern = buildPatternFromPrefix(
        format.legacyPrefixKey ? settings[format.legacyPrefixKey] : null,
        format.defaultResetPolicy,
        format.defaultPattern,
      );
      const startAt = parseStartAt(
        format.legacyNextKey ? settings[format.legacyNextKey] : null,
        format.defaultStartAt,
      );

      const existing = await prisma.numberSeries.findUnique({
        where: {
          tenantId_companyId_key: {
            tenantId,
            companyId: company.id,
            key: format.key,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        await prisma.numberSeries.create({
          data: {
            tenantId,
            companyId: company.id,
            key: format.key,
            name: format.name,
            pattern,
            resetPolicy: format.defaultResetPolicy,
            startAt,
            padding: format.defaultPadding,
            isActive: true,
            metadata: {
              migratedFromOrgSetting: Boolean(format.legacyPrefixKey || format.legacyNextKey),
            },
          },
        });
        created += 1;
      } else {
        await prisma.numberSeries.update({
          where: { id: existing.id },
          data: {
            name: format.name,
            pattern,
            resetPolicy: format.defaultResetPolicy,
            startAt,
            padding: format.defaultPadding,
          },
        });
        updated += 1;
      }
    }
  }

  console.log("Company numbering backfill complete", {
    companies: companies.length,
    created,
    updated,
  });
}

main()
  .catch((error) => {
    console.error("Company numbering backfill failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
