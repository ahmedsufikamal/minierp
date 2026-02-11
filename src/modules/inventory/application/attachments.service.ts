import { prisma } from "@/lib/prisma";
import { attachmentCreateSchema, attachmentFinalizeSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";
import { createDownloadUrl, createUploadUrl } from "@/modules/inventory/infrastructure/storage";

export async function createAttachmentUpload(ctx: InventoryRequestContext, input: unknown) {
  const parsed = attachmentCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid attachment payload", parsed.error.flatten());
  }

  const upload = createUploadUrl({
    companyId: ctx.companyId,
    fileName: parsed.data.fileName,
    mimeType: parsed.data.mimeType,
  });

  const attachment = await prisma.inventoryAttachment.create({
    data: {
      companyId: ctx.companyId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      storageKey: upload.storageKey,
      uploadedBy: ctx.userId,
      scanStatus: "PENDING",
      metadata: {
        uploadStartedAt: new Date().toISOString(),
      },
    },
  });

  await writeInventoryAudit(ctx, {
    action: "ATTACHMENT_UPLOAD_REQUESTED",
    entityType: "InventoryAttachment",
    entityId: attachment.id,
    after: attachment,
  });

  return {
    attachment,
    upload,
  };
}

export async function finalizeAttachmentUpload(ctx: InventoryRequestContext, input: unknown) {
  const parsed = attachmentFinalizeSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid attachment finalize payload", parsed.error.flatten());
  }

  const attachment = await prisma.inventoryAttachment.findFirst({
    where: {
      id: parsed.data.attachmentId,
      companyId: ctx.companyId,
    },
  });

  if (!attachment) {
    throw new InventoryError("NOT_FOUND", "Attachment not found");
  }

  if (attachment.storageKey !== parsed.data.storageKey) {
    throw new InventoryError("CONFLICT", "storageKey mismatch for attachment finalize");
  }

  const updated = await prisma.inventoryAttachment.update({
    where: { id: attachment.id },
    data: {
      uploadedAt: new Date(),
      scanStatus: "NOT_SCANNED",
      metadata: {
        ...(attachment.metadata as Record<string, unknown> | null),
        finalizedAt: new Date().toISOString(),
      },
    },
  });

  await writeInventoryAudit(ctx, {
    action: "ATTACHMENT_UPLOADED",
    entityType: "InventoryAttachment",
    entityId: updated.id,
    before: attachment,
    after: updated,
  });

  return updated;
}

export async function getAttachmentDownload(ctx: InventoryRequestContext, attachmentId: string) {
  const attachment = await prisma.inventoryAttachment.findFirst({
    where: {
      id: attachmentId,
      companyId: ctx.companyId,
    },
  });

  if (!attachment) {
    throw new InventoryError("NOT_FOUND", "Attachment not found");
  }

  return {
    attachment,
    download: createDownloadUrl({ storageKey: attachment.storageKey }),
  };
}

export async function listAttachmentsForEntity(
  ctx: InventoryRequestContext,
  params: { entityType: "ITEM" | "DOCUMENT"; entityId: string },
) {
  return prisma.inventoryAttachment.findMany({
    where: {
      companyId: ctx.companyId,
      entityType: params.entityType,
      entityId: params.entityId,
    },
    orderBy: { uploadedAt: "desc" },
  });
}
