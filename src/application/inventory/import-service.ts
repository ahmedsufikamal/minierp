import { computeFileHash, parseExcelFile, parseQty, parseStoreLocations, allocateQtyToLocations } from "@/lib/excel-import";
import { normalizeSku } from "@/domain/inventory/sku";
import { inventoryRepo } from "@/infrastructure/inventory/repository";
import type { ImportMode, ImportPreview, ImportPreviewResult, ImportExecuteResult } from "./dtos";
import { prisma } from "@/lib/prisma";

const DEFAULT_BRAND = "SIEMENS";

export async function previewImport(params: {
  companyId: string;
  file: File;
  brandOverride?: string | null;
  mode?: ImportMode;
  actorId?: string | null;
}): Promise<ImportPreviewResult> {
  const { companyId, file, brandOverride, mode = "OPENING_ONLY", actorId } = params;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = await computeFileHash(fileBuffer);

  const repo = inventoryRepo();
  let existingSnapshot = null;
  try {
    existingSnapshot = await repo.findSnapshotByHash(companyId, fileHash);
  } catch (error: any) {
    if (error?.code === "P2021" || error?.code === "P2022" || error?.message?.includes("does not exist")) {
      return { ok: false, error: "Database migration required. Please run: npx prisma migrate dev" };
    }
    throw error;
  }

  const parsed = parseExcelFile(fileBuffer);
  if (parsed.errors.length > 0 && parsed.totalSummary.length === 0) {
    return { ok: false, error: parsed.errors.join("; ") };
  }

  const previewRows: ImportPreview["rows"] = [];
  const allBrands = new Set<string>();
  const allCategories = new Set<string>();
  const allLocations = new Set<string>();
  let totalQty = 0;
  let totalValue = 0;

  for (const row of parsed.totalSummary) {
    if (!row.mlfb) continue;
    const brand = brandOverride || row.brand || DEFAULT_BRAND;
    allBrands.add(brand);
    if (row.category) allCategories.add(row.category);
    const inventoryQty = row.inventoryQty ?? 0;
    const rateInBDT = row.rateInBDT ?? 0;
    totalQty += inventoryQty;
    totalValue += inventoryQty * rateInBDT;

    const locationRows = parsed.locations.filter((loc) => loc.newStock === row.mlfb);
    const locationAllocations: Array<{ location: string; qty: number; warning?: string }> = [];
    if (locationRows.length > 0) {
      for (const locRow of locationRows) {
        const locations = parseStoreLocations(locRow.storeLocation);
        const qty = parseQty(locRow.qty);
        if (locations.length > 0 && qty > 0) {
          const allocations = allocateQtyToLocations(qty, locations);
          locationAllocations.push(...allocations);
          allocations.forEach((a) => {
            if (a.location) allLocations.add(a.location);
          });
        }
      }
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    const locationQtySum = locationAllocations.reduce((sum, a) => sum + a.qty, 0);
    if (locationQtySum > 0 && locationQtySum !== inventoryQty) {
      warnings.push(`Location qty sum (${locationQtySum}) does not match inventory qty (${inventoryQty})`);
    }
    locationAllocations.forEach((a) => {
      if (a.warning) warnings.push(a.warning);
    });

    previewRows.push({
      mlfb: row.mlfb,
      brand,
      inventoryQty,
      rateInBDT,
      category: row.category,
      subCategory: row.subCategory,
      description: row.description,
      locations: locationAllocations,
      warnings,
      errors,
    });
  }

  const preview: ImportPreview = {
    rows: previewRows,
    summary: {
      totalItems: previewRows.length,
      totalQty,
      totalValue,
      brands: Array.from(allBrands),
      categories: Array.from(allCategories),
      locations: Array.from(allLocations),
    },
    errors: parsed.errors,
    warnings: parsed.warnings,
    fileHash,
    alreadyImported: !!existingSnapshot,
    snapshotId: existingSnapshot?.id,
  };

  if (!existingSnapshot) {
    await repo.createSnapshot({
      companyId,
      sourceFileName: file.name,
      sourceFileHash: fileHash,
      mode,
      status: "VALIDATED",
      warnings: parsed.warnings,
      errors: parsed.errors,
      createdBy: actorId ?? null,
    });
  } else if (existingSnapshot.status !== "IMPORTED") {
    await repo.updateSnapshot(existingSnapshot.id, {
      status: "VALIDATED",
      warnings: parsed.warnings,
      errors: parsed.errors,
      mode,
    });
  }

  return { ok: true, data: preview };
}

export async function executeImport(params: {
  companyId: string;
  file: File;
  brandOverride?: string | null;
  forceReimport?: boolean;
  mode?: ImportMode;
  actorId?: string | null;
}): Promise<ImportExecuteResult> {
  const { companyId, file, brandOverride, forceReimport = false, mode = "OPENING_ONLY", actorId } = params;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = await computeFileHash(fileBuffer);

  const repo = inventoryRepo();
  let existingSnapshot = null;
  try {
    existingSnapshot = await repo.findSnapshotByHash(companyId, fileHash);
  } catch (error: any) {
    if (error?.code === "P2021" || error?.code === "P2022" || error?.message?.includes("does not exist")) {
      return { ok: false, error: "Database migration required. Please run: npx prisma migrate dev" };
    }
    throw error;
  }

  if (existingSnapshot && existingSnapshot.status === "IMPORTED" && !forceReimport) {
    return {
      ok: false,
      error: `This file was already imported on ${existingSnapshot.importedAt.toISOString()}. Use force re-import to import again.`,
    };
  }

  const parsed = parseExcelFile(fileBuffer);
  if (parsed.errors.length > 0 && parsed.totalSummary.length === 0) {
    return { ok: false, error: parsed.errors.join("; ") };
  }

  try {
    await prisma.brand.findFirst({ where: { companyId }, take: 1 });
  } catch (error: any) {
    if (error?.code === "P2021" || error?.code === "P2022" || error?.message?.includes("does not exist")) {
      return { ok: false, error: "Database migration required. Please run: npx prisma migrate dev" };
    }
    throw error;
  }

  const snapshotId = await prisma.$transaction(async (tx) => {
    const txRepo = inventoryRepo(tx);
    const snapshot =
      existingSnapshot ??
      (await txRepo.createSnapshot({
        companyId,
        sourceFileName: file.name,
        sourceFileHash: fileHash,
        mode,
        status: "PENDING",
        warnings: parsed.warnings,
        errors: parsed.errors,
        createdBy: actorId ?? null,
      }));

    if (existingSnapshot && forceReimport) {
      const previousLedger = await txRepo.findLedgerBySnapshot(companyId, snapshot.id);
      for (const entry of previousLedger) {
        await txRepo.createLedger({
          companyId,
          itemId: entry.itemId,
          locationId: entry.locationId,
          txnType: "REVERSAL",
          qtyDelta: -entry.qtyDelta,
          unitCostMinor: entry.unitCostMinor ?? 0,
          totalCostMinor: entry.totalCostMinor ? -entry.totalCostMinor : 0,
          refInvoice: entry.refInvoice ?? null,
          refChalan: entry.refChalan ?? null,
          notes: "Reversal for force re-import",
          meta: { reversedEntryId: entry.id },
          txnDate: new Date(),
          snapshotId: snapshot.id,
          createdBy: actorId ?? null,
        });
      }
    }

    const reconciliationNotes: string[] = [];

    for (const row of parsed.totalSummary) {
      if (!row.mlfb) continue;
      const brandName = brandOverride || row.brand || DEFAULT_BRAND;
      const brand = await txRepo.upsertBrand(companyId, brandName);

      let categoryId: string | undefined;
      if (row.category) {
        const category = await txRepo.upsertCategory(companyId, row.category);
        categoryId = category.id;
      }

      let subCategoryId: string | undefined;
      if (row.subCategory && categoryId) {
        const subCategory = await txRepo.upsertSubCategory(companyId, categoryId, row.subCategory);
        subCategoryId = subCategory.id;
      }

      const inventoryQty = row.inventoryQty ?? 0;
      const rateInBDT = row.rateInBDT ?? 0;
      let finalUnitCost = rateInBDT > 0 ? Math.round(rateInBDT * 100) : 0;
      if (finalUnitCost === 0 && row.totalCostPriceInBDT && inventoryQty > 0) {
        finalUnitCost = Math.round((row.totalCostPriceInBDT / inventoryQty) * 100);
      }

      const normalizedSku = normalizeSku(row.mlfb);
      const product = await txRepo.upsertProduct({
        where: {
          companyId_brandId_normalizedSku: {
            companyId,
            brandId: brand.id,
            normalizedSku,
          },
        },
        create: {
          companyId,
          brandId: brand.id,
          sku: row.mlfb,
          normalizedSku,
          name: row.description || row.mlfb,
          title: row.description || null,
          description: row.description,
          ratingType: row.ratingType,
          coo: row.coo,
          categoryId,
          subCategoryId,
          uom: "pcs",
          priceCents: finalUnitCost,
          unitCostMinor: finalUnitCost,
          isActive: true,
        },
        update: {
          name: row.description || row.mlfb,
          title: row.description || null,
          description: row.description,
          ratingType: row.ratingType,
          coo: row.coo,
          categoryId: categoryId ?? undefined,
          subCategoryId: subCategoryId ?? undefined,
          priceCents: finalUnitCost,
          unitCostMinor: finalUnitCost,
        },
      });

      const refParts: string[] = [];
      if (row.invoiceNum) refParts.push(`Invoice: ${row.invoiceNum}`);
      if (row.chalanNumber) refParts.push(`Chalan: ${row.chalanNumber}`);
      if (row.inDate) refParts.push(`In: ${row.inDate}`);
      if (row.outDate) refParts.push(`Out: ${row.outDate}`);
      if (row.remarks) refParts.push(`Remarks: ${row.remarks}`);
      const refText = refParts.length > 0 ? refParts.join(" | ") : null;

      if (inventoryQty > 0) {
        await txRepo.createLedger({
          companyId,
          itemId: product.id,
          locationId: null,
          txnType: "OPENING",
          qtyDelta: inventoryQty,
          unitCostMinor: finalUnitCost,
          totalCostMinor: finalUnitCost * inventoryQty,
          refInvoice: row.invoiceNum || null,
          refChalan: row.chalanNumber || null,
          notes: row.remarks || refText,
          meta: { raw: row },
          txnDate: new Date(),
          snapshotId: snapshot.id,
          createdBy: actorId ?? null,
        });

        await txRepo.upsertBalance({
          where: {
            companyId_itemId_locationId: {
              companyId,
              itemId: product.id,
              locationId: null,
            },
          },
          create: {
            companyId,
            itemId: product.id,
            locationId: null,
            qtyOnHand: inventoryQty,
            avgCostMinor: finalUnitCost,
          },
          update: {
            qtyOnHand: inventoryQty,
            avgCostMinor: finalUnitCost,
          },
        });
      }

      const locationRows = parsed.locations.filter((loc) => loc.newStock === row.mlfb);
      let locationQtySum = 0;
      for (const locRow of locationRows) {
        const locations = parseStoreLocations(locRow.storeLocation);
        const qty = parseQty(locRow.qty);
        if (locations.length > 0 && qty > 0) {
          const allocations = allocateQtyToLocations(qty, locations);
          locationQtySum += qty;
          for (const alloc of allocations) {
            if (alloc.qty <= 0) continue;
            const stockLocation = await txRepo.upsertLocation(companyId, alloc.location);
            await txRepo.createLedger({
              companyId,
              itemId: product.id,
              locationId: stockLocation.id,
              txnType: "OPENING",
              qtyDelta: alloc.qty,
              unitCostMinor: finalUnitCost,
              totalCostMinor: finalUnitCost * alloc.qty,
              refInvoice: row.invoiceNum || null,
              refChalan: row.chalanNumber || null,
              notes: row.remarks || refText,
              meta: { raw: row },
              txnDate: new Date(),
              snapshotId: snapshot.id,
              createdBy: actorId ?? null,
            });
            await txRepo.upsertBalance({
              where: {
                companyId_itemId_locationId: {
                  companyId,
                  itemId: product.id,
                  locationId: stockLocation.id,
                },
              },
              create: {
                companyId,
                itemId: product.id,
                locationId: stockLocation.id,
                qtyOnHand: alloc.qty,
                avgCostMinor: finalUnitCost,
              },
              update: {
                qtyOnHand: alloc.qty,
                avgCostMinor: finalUnitCost,
              },
            });
          }
        }
      }

      if (locationQtySum > 0 && locationQtySum !== inventoryQty) {
        reconciliationNotes.push(
          `${row.mlfb}: Location qty (${locationQtySum}) != Inventory qty (${inventoryQty})`,
        );
      }
    }

    await txRepo.updateSnapshot(snapshot.id, {
      status: "IMPORTED",
      warnings: reconciliationNotes.length > 0 ? reconciliationNotes : parsed.warnings,
      errors: parsed.errors,
      importedAt: new Date(),
    });

    return snapshot.id;
  });

  return { ok: true, snapshotId };
}
