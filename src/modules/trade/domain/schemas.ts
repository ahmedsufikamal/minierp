import { z } from "zod";

const optionalText = () => z.string().trim().min(1).optional();
const optionalDate = () => z.coerce.date().optional();

const lcLinkSchema = z.object({
  purchaseOrderId: z.string().trim().min(1),
  coveredAmount: z.coerce.number().positive(),
  coveredCurrency: z.string().trim().min(1),
  externalReference: optionalText(),
});

export const paginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const lcListQuerySchema = paginationQuerySchema.extend({
  query: z.string().trim().optional(),
  status: z.string().trim().optional(),
  bank: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const lcBaseSchema = z.object({
  lcType: z.enum(["IMPORT", "EXPORT"]).default("IMPORT"),
  beneficiaryVendorId: z.string().trim().min(1),
  issuingBankId: z.string().trim().min(1),
  advisingBankId: z.string().trim().optional(),
  confirmingBankId: z.string().trim().optional(),
  currency: z.string().trim().min(1),
  lcAmount: z.coerce.number().positive(),
  tolerancePercent: z.coerce.number().min(0).max(100).optional(),
  issueDate: optionalDate(),
  maturityDate: optionalDate(),
  latestShipmentDate: optionalDate(),
  expiryDate: z.coerce.date(),
  placeOfExpiry: optionalText(),
  shipmentFrom: optionalText(),
  shipmentTo: optionalText(),
  portOfLoading: optionalText(),
  portOfDischarge: optionalText(),
  partialShipmentAllowed: z.coerce.boolean().optional().default(false),
  transshipmentAllowed: z.coerce.boolean().optional().default(false),
  marginPercent: z.coerce.number().min(0).max(100).optional(),
  marginAmount: z.coerce.number().min(0).optional(),
  lienReference: optionalText(),
  incotermCode: z.string().trim().optional(),
  remarks: optionalText(),
  termsText: optionalText(),
  linkedPurchaseOrders: z.array(lcLinkSchema).optional().default([]),
  documentTemplateCodes: z.array(z.string().trim().min(1)).optional().default([]),
});

function withLcDateValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const record = value as Record<string, unknown>;
    const issueDate = record.issueDate instanceof Date ? record.issueDate : undefined;
    const expiryDate = record.expiryDate instanceof Date ? record.expiryDate : undefined;
    const latestShipmentDate =
      record.latestShipmentDate instanceof Date ? record.latestShipmentDate : undefined;
    const maturityDate = record.maturityDate instanceof Date ? record.maturityDate : undefined;

    if (expiryDate && issueDate && expiryDate < issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message: "expiry_date must be on or after issue_date",
      });
    }

    if (expiryDate && latestShipmentDate && latestShipmentDate > expiryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["latestShipmentDate"],
        message: "latest_shipment_date must be on or before expiry_date",
      });
    }

    if (issueDate && maturityDate && maturityDate < issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maturityDate"],
        message: "maturity_date must be on or after issue_date",
      });
    }
  });
}

export const lcCreateSchema = withLcDateValidation(lcBaseSchema);

export const lcUpdateSchema = withLcDateValidation(
  lcBaseSchema.partial().extend({
    version: z.coerce.number().int().min(1),
  }),
);

export const lcActionVersionSchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});

export const lcAmendmentCreateSchema = z.object({
  amendmentNo: z.string().trim().min(1).optional(),
  amendmentDate: z.coerce.date(),
  changesJson: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().trim().min(1),
});

export const lcDocsetListQuerySchema = paginationQuerySchema.extend({
  status: z.string().trim().optional(),
  lcId: z.string().trim().optional(),
});

export const lcDocsetCreateSchema = z.object({
  shipmentRef: optionalText(),
  shipmentDate: optionalDate(),
  etaDate: optionalDate(),
  docsReceivedDate: optionalDate(),
  verificationNotes: optionalText(),
});

export const lcDocsetUpdateSchema = z.object({
  shipmentRef: optionalText(),
  shipmentDate: optionalDate(),
  etaDate: optionalDate(),
  docsReceivedDate: optionalDate(),
  verificationNotes: optionalText(),
  status: z.enum(["PENDING", "RECEIVED", "VERIFIED", "DISCREPANT", "ACCEPTED", "REJECTED"]).optional(),
  documentLines: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        received: z.coerce.boolean().optional(),
        referenceNo: optionalText(),
        issueDate: optionalDate(),
        notes: optionalText(),
        attachmentId: z.string().trim().optional(),
      }),
    )
    .optional()
    .default([]),
});

export const lcDiscrepancyCreateSchema = z.object({
  documentSetId: z.string().trim().optional(),
  code: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export const lcDiscrepancyPatchSchema = z.object({
  title: optionalText(),
  description: optionalText(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  decisionNotes: optionalText(),
  decision: z.enum(["ACCEPTED"]).optional(),
});

export const lcChargeCreateSchema = z.object({
  chargeTypeCode: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(1),
  chargedBy: z.enum(["BANK", "INTERNAL"]).default("BANK"),
  chargeDate: z.coerce.date(),
  allocatable: z.coerce.boolean().optional().default(false),
  allocationTarget: z.enum(["LANDED_COST", "EXPENSE"]).optional(),
  allocationNotes: optionalText(),
});

export const lcPaymentCreateSchema = z.object({
  paymentType: z.enum(["MARGIN", "SETTLEMENT", "CHARGE", "OTHER"]),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(1),
  paymentDate: z.coerce.date().optional(),
  valueDate: optionalDate(),
  method: z.enum(["BANK_TRANSFER", "TT", "CASH", "OTHER"]),
  bankAccountId: z.string().trim().optional(),
  status: z.enum(["PLANNED", "INITIATED", "PAID", "REVERSED"]).optional(),
  externalRef: optionalText(),
  notes: optionalText(),
});

export const lcPaymentMarkPaidSchema = z.object({
  paymentDate: z.coerce.date().optional(),
  valueDate: optionalDate(),
});

export const lcReportQuerySchema = z.object({
  status: z.string().trim().optional(),
  bank: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

export const lcSettingsPatchSchema = z.object({
  dualControlEnabled: z.coerce.boolean().optional(),
  expiringSoonDays: z.coerce.number().int().min(1).max(365).optional(),
  maturitySoonDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const lcBankCreateSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  swift: optionalText(),
  address: optionalText(),
  country: optionalText(),
  isActive: z.coerce.boolean().optional(),
});

export const lcBankPatchSchema = lcBankCreateSchema.partial();

export const lcDocumentTypeCreateSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: optionalText(),
  defaultRequired: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const lcDocumentTypePatchSchema = lcDocumentTypeCreateSchema.partial();

export const lcChargeTypeCreateSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  defaultAllocatable: z.coerce.boolean().optional(),
  defaultAllocationTarget: z.enum(["LANDED_COST", "EXPENSE"]).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const lcChargeTypePatchSchema = lcChargeTypeCreateSchema.partial();

export const lcIncotermCreateSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: optionalText(),
  isActive: z.coerce.boolean().optional(),
});

export const lcIncotermPatchSchema = lcIncotermCreateSchema.partial();

export const lcAttachmentUploadUrlSchema = z.object({
  lcId: z.string().trim().optional(),
  documentLineId: z.string().trim().optional(),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.coerce.number().int().min(1),
});

export const lcAttachmentFinalizeSchema = z.object({
  attachmentId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1),
});
