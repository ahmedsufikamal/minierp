import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/modules/platform/application/audit-ledger.service";
import {
  enforcePublishedWorkflowTransition,
  seedCoreMetaModels,
  validateCustomDataAgainstPublishedMetadata,
} from "@/modules/platform/application/meta-model.service";
import { piiMasked } from "@/modules/platform/application/meta-security.service";
import {
  masterPartyMergeSchema,
  masterPartiesQuerySchema,
  masterPartyUpsertSchema,
} from "@/modules/platform/domain/meta-master-schemas";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9+]/g, "");
  return digits || null;
}

function dedupFingerprint(input: {
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  addresses?: Array<{ line1?: string | null; postalCode?: string | null }>;
}): string {
  const address = input.addresses?.[0];
  const parts = [
    normalizeText(input.taxId),
    normalizeText(input.email),
    normalizePhone(input.phone),
    normalizeText(input.name),
    normalizeText(address?.line1 ?? null),
    normalizeText(address?.postalCode ?? null),
  ].filter(Boolean);

  return parts.join("|");
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function decodeCursor(cursor: string | undefined): { id: string } | undefined {
  if (!cursor) return undefined;
  return { id: cursor };
}

async function findPartyByIdOrThrow(ctx: PlatformRequestContext, partyId: string) {
  const row = await prisma.masterParty.findFirst({
    where: {
      id: partyId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    include: {
      addresses: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
    },
  });

  if (!row) {
    throw new PlatformError("NOT_FOUND", "Party not found");
  }

  return row;
}

export async function listMasterParties(ctx: PlatformRequestContext, input: unknown) {
  await seedCoreMetaModels(ctx);
  const parsed = masterPartiesQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid party query", parsed.error.flatten());
  }

  const query = parsed.data;
  const cursor = decodeCursor(query.cursor);

  const where: Prisma.MasterPartyWhereInput = {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    isDeleted: false,
    ...(query.query?.trim()
      ? {
          OR: [
            { partyCode: { contains: query.query, mode: "insensitive" } },
            { name: { contains: query.query, mode: "insensitive" } },
            { displayName: { contains: query.query, mode: "insensitive" } },
            { email: { contains: query.query, mode: "insensitive" } },
            { phone: { contains: query.query, mode: "insensitive" } },
            { taxId: { contains: query.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.masterParty.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor, skip: 1 } : {}),
    include: {
      addresses: {
        where: { isDeleted: false },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      contacts: {
        where: { isDeleted: false },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;

  return {
    rows: pageRows,
    limit: query.limit,
    cursor: nextCursor,
  };
}

export async function createMasterParty(ctx: PlatformRequestContext, input: unknown) {
  await seedCoreMetaModels(ctx);
  const parsed = masterPartyUpsertSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid party payload", parsed.error.flatten());
  }

  const data = parsed.data;
  await validateCustomDataAgainstPublishedMetadata(ctx, "Party", data.customData);

  const fingerprint = dedupFingerprint({
    name: data.name,
    taxId: data.taxId,
    email: data.email,
    phone: data.phone,
    addresses: data.addresses,
  });

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.masterParty.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        partyCode: data.partyCode,
        name: data.name,
        displayName: data.displayName ?? null,
        partyType: data.partyType,
        status: data.status,
        taxId: data.taxId ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        tags: toJsonValue(data.tags ?? null),
        customData: toJsonValue(data.customData ?? {}),
        dedupFingerprint: fingerprint || null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    if (data.addresses.length > 0) {
      await tx.masterAddress.createMany({
        data: data.addresses.map((address) => ({
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          partyId: row.id,
          addressType: address.addressType,
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city ?? null,
          state: address.state ?? null,
          postalCode: address.postalCode ?? null,
          country: address.country ?? null,
          isPrimary: address.isPrimary ?? false,
          isDeleted: address.isDeleted ?? false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      });
    }

    if (data.contacts.length > 0) {
      await tx.masterContact.createMany({
        data: data.contacts.map((contact) => ({
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          partyId: row.id,
          firstName: contact.firstName ?? null,
          lastName: contact.lastName ?? null,
          fullName: contact.fullName ?? null,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          designation: contact.designation ?? null,
          isPrimary: contact.isPrimary ?? false,
          isDeleted: contact.isDeleted ?? false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      });
    }

    return row.id;
  });

  const party = await findPartyByIdOrThrow(ctx, created);

  await appendAuditEvent(ctx, {
    source: "master.party",
    action: "master.party.created",
    entityType: "MasterParty",
    entityId: party.id,
    after: {
      partyCode: party.partyCode,
      name: party.name,
      partyType: party.partyType,
      status: party.status,
    },
    metadata: {
      maskedEmail: piiMasked(party.email),
      maskedPhone: piiMasked(party.phone),
    },
  });

  return party;
}

export async function updateMasterParty(ctx: PlatformRequestContext, partyId: string, input: unknown) {
  await seedCoreMetaModels(ctx);
  const parsed = masterPartyUpsertSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid party payload", parsed.error.flatten());
  }

  const data = parsed.data;
  const existing = await findPartyByIdOrThrow(ctx, partyId);

  if (data.customData !== undefined) {
    await validateCustomDataAgainstPublishedMetadata(ctx, "Party", data.customData);
  }

  const nextStatus = data.status ?? existing.status;
  if (nextStatus !== existing.status) {
    await enforcePublishedWorkflowTransition(ctx, {
      modelName: "Party",
      fromState: existing.status,
      toState: nextStatus,
      actionKey: "STATUS_CHANGE",
    });
  }

  const nextFingerprint = dedupFingerprint({
    name: data.name ?? existing.name,
    taxId: data.taxId ?? existing.taxId,
    email: data.email ?? existing.email,
    phone: data.phone ?? existing.phone,
    addresses: (data.addresses as Array<{ line1?: string | null; postalCode?: string | null }> | undefined) ??
      existing.addresses,
  });

  await prisma.$transaction(async (tx) => {
    await tx.masterParty.update({
      where: { id: existing.id },
      data: {
        partyCode: data.partyCode,
        name: data.name,
        displayName: data.displayName,
        partyType: data.partyType,
        status: nextStatus,
        taxId: data.taxId,
        email: data.email,
        phone: data.phone,
        website: data.website,
        tags: data.tags === undefined ? undefined : toJsonValue(data.tags ?? null),
        customData: data.customData === undefined ? undefined : toJsonValue(data.customData ?? {}),
        dedupFingerprint: nextFingerprint || null,
        updatedBy: ctx.userId,
      },
    });

    if (data.addresses) {
      for (const address of data.addresses) {
        if (address.id) {
          await tx.masterAddress.updateMany({
            where: {
              id: address.id,
              partyId: existing.id,
              tenantId: ctx.tenantId,
              companyId: ctx.companyId,
            },
            data: {
              addressType: address.addressType,
              line1: address.line1,
              line2: address.line2 ?? null,
              city: address.city ?? null,
              state: address.state ?? null,
              postalCode: address.postalCode ?? null,
              country: address.country ?? null,
              isPrimary: address.isPrimary ?? false,
              isDeleted: address.isDeleted ?? false,
              updatedBy: ctx.userId,
            },
          });
        } else {
          await tx.masterAddress.create({
            data: {
              tenantId: ctx.tenantId,
              companyId: ctx.companyId,
              partyId: existing.id,
              addressType: address.addressType,
              line1: address.line1,
              line2: address.line2 ?? null,
              city: address.city ?? null,
              state: address.state ?? null,
              postalCode: address.postalCode ?? null,
              country: address.country ?? null,
              isPrimary: address.isPrimary ?? false,
              isDeleted: address.isDeleted ?? false,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
          });
        }
      }
    }

    if (data.contacts) {
      for (const contact of data.contacts) {
        if (contact.id) {
          await tx.masterContact.updateMany({
            where: {
              id: contact.id,
              partyId: existing.id,
              tenantId: ctx.tenantId,
              companyId: ctx.companyId,
            },
            data: {
              firstName: contact.firstName ?? null,
              lastName: contact.lastName ?? null,
              fullName: contact.fullName ?? null,
              email: contact.email ?? null,
              phone: contact.phone ?? null,
              designation: contact.designation ?? null,
              isPrimary: contact.isPrimary ?? false,
              isDeleted: contact.isDeleted ?? false,
              updatedBy: ctx.userId,
            },
          });
        } else {
          await tx.masterContact.create({
            data: {
              tenantId: ctx.tenantId,
              companyId: ctx.companyId,
              partyId: existing.id,
              firstName: contact.firstName ?? null,
              lastName: contact.lastName ?? null,
              fullName: contact.fullName ?? null,
              email: contact.email ?? null,
              phone: contact.phone ?? null,
              designation: contact.designation ?? null,
              isPrimary: contact.isPrimary ?? false,
              isDeleted: contact.isDeleted ?? false,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
          });
        }
      }
    }
  });

  const updated = await findPartyByIdOrThrow(ctx, existing.id);

  await appendAuditEvent(ctx, {
    source: "master.party",
    action: "master.party.updated",
    entityType: "MasterParty",
    entityId: updated.id,
    before: {
      partyCode: existing.partyCode,
      name: existing.name,
      status: existing.status,
    },
    after: {
      partyCode: updated.partyCode,
      name: updated.name,
      status: updated.status,
    },
    metadata: {
      maskedEmail: piiMasked(updated.email),
      maskedPhone: piiMasked(updated.phone),
    },
  });

  return updated;
}

export async function mergeMasterParty(ctx: PlatformRequestContext, sourcePartyId: string, input: unknown) {
  await seedCoreMetaModels(ctx);
  const parsed = masterPartyMergeSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid merge payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  if (payload.targetPartyId === sourcePartyId) {
    throw new PlatformError("VALIDATION_ERROR", "Source and target party must be different");
  }

  const [source, target] = await Promise.all([
    findPartyByIdOrThrow(ctx, sourcePartyId),
    findPartyByIdOrThrow(ctx, payload.targetPartyId),
  ]);

  if (source.isDeleted) {
    throw new PlatformError("VALIDATION_ERROR", "Source party already merged or deleted");
  }

  await prisma.$transaction(async (tx) => {
    await tx.masterAddress.updateMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        partyId: source.id,
        isDeleted: false,
      },
      data: {
        partyId: target.id,
        updatedBy: ctx.userId,
      },
    });

    await tx.masterContact.updateMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        partyId: source.id,
        isDeleted: false,
      },
      data: {
        partyId: target.id,
        updatedBy: ctx.userId,
      },
    });

    await tx.masterParty.update({
      where: { id: source.id },
      data: {
        status: "MERGED",
        isDeleted: true,
        mergedIntoPartyId: target.id,
        updatedBy: ctx.userId,
      },
    });

    await tx.masterPartyMergeHistory.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        sourcePartyId: source.id,
        targetPartyId: target.id,
        changedFields: {
          movedAddresses: source.addresses.filter((entry) => !entry.isDeleted).length,
          movedContacts: source.contacts.filter((entry) => !entry.isDeleted).length,
        } as Prisma.InputJsonValue,
        note: payload.note ?? null,
        actorUserId: ctx.userId,
      },
    });
  });

  await appendAuditEvent(ctx, {
    source: "master.party",
    action: "master.party.merged",
    entityType: "MasterParty",
    entityId: source.id,
    before: {
      sourcePartyCode: source.partyCode,
      targetPartyCode: target.partyCode,
    },
    after: {
      mergedIntoPartyId: target.id,
      sourceStatus: "MERGED",
    },
    metadata: {
      note: payload.note ?? null,
      sourceMaskedEmail: piiMasked(source.email),
      sourceMaskedPhone: piiMasked(source.phone),
      targetMaskedEmail: piiMasked(target.email),
      targetMaskedPhone: piiMasked(target.phone),
    },
  });

  return {
    sourcePartyId: source.id,
    targetPartyId: target.id,
    mergedAt: new Date().toISOString(),
  };
}
