import { NumberSeriesResetPolicy } from "@prisma/client";
import { z } from "zod";
import type { CompanyCodeFormatConfig, CompanyCodeFormatKey } from "@/modules/platform/domain/company-numbering";

export const companyCodeSettingsVersion = 1;

export const companyCodeDefinitionKeys = [
  "QUOTATION",
  "BUDGETARY",
  "DELIVERY_CHALLAN",
  "INVOICE",
  "SPOT_SALE",
] as const;

export type CompanyCodeDefinitionKey = (typeof companyCodeDefinitionKeys)[number];

export const codeFormatVariantKinds = [
  "STANDARD",
  "PREVIOUS_YEAR",
  "PROJECT",
  "SPOT_OFFER",
  "SPOT_CHALLAN",
  "SPOT_INVOICE",
] as const;

export type CodeFormatVariantKind = (typeof codeFormatVariantKinds)[number];

export const tokenKinds = [
  "STATIC",
  "SEPARATOR",
  "OFFER_NUMBER",
  "CLIENT_SHORT_CODE",
  "QUOTE_MONTH",
  "QUOTE_YEAR",
  "DELIVERY_MONTH",
  "DELIVERY_YEAR",
  "INVOICE_MONTH",
  "INVOICE_YEAR",
  "SALESPERSON_INITIALS",
  "REVISION_NUMBER",
  "SERIAL_NUMBER",
] as const;

export type TokenKind = (typeof tokenKinds)[number];

export const sequenceScopes = ["YEARLY", "COMPANY", "PROJECT", "GLOBAL"] as const;
export type SequenceScope = (typeof sequenceScopes)[number];

export const validationSeverities = ["error", "warning"] as const;
export type ValidationSeverity = (typeof validationSeverities)[number];

export type SequenceRule = {
  namespace: string;
  startAt: number;
  zeroPadding: number;
  resetPolicy: NumberSeriesResetPolicy;
  scope: SequenceScope;
};

export type TokenDefinition = {
  id: string;
  kind: TokenKind;
  label: string;
  required: boolean;
  staticValue?: string | null;
  separator?: string | null;
  yearFormat?: "YY" | "YYYY" | null;
  sequenceRule?: SequenceRule | null;
  notes?: string | null;
};

export type CodeFormatVariant = {
  id: string;
  label: string;
  description: string;
  kind: CodeFormatVariantKind;
  enabled: boolean;
  notes?: string | null;
  primarySequenceTokenId: string | null;
  tokens: TokenDefinition[];
};

export type CodeFormatDefinition = {
  key: CompanyCodeDefinitionKey;
  internalKey: CompanyCodeDefinitionKey;
  displayName: string;
  description: string;
  enabled: boolean;
  adminNotes?: string | null;
  activeVariantId: string;
  effectiveDate?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  version: number;
  variants: CodeFormatVariant[];
};

export type CompanyCodeFormatSettingsEnvelope = {
  version: number;
  companyId?: string | null;
  source: "stored" | "derived-flat" | "ygen-defaults";
  warnings: string[];
  updatedAt?: string | null;
  updatedBy?: string | null;
  definitions: CodeFormatDefinition[];
};

export type PreviewInput = {
  clientShortCode: string;
  offerNumber: number;
  budgetaryOfferNumber: number;
  spotSaleOfferNumber: number;
  quoteMonth: string;
  quoteYear: string;
  deliveryMonth: string;
  deliveryYear: string;
  invoiceMonth: string;
  invoiceYear: string;
  salespersonInitials: string;
  revisionNumber: number;
  serialNumber: number;
  projectSerialNumber: number;
};

export type ValidationIssue = {
  severity: ValidationSeverity;
  key: CompanyCodeDefinitionKey;
  variantId?: string;
  field?: string;
  message: string;
};

export type ChangeSummary = {
  changedKeys: CompanyCodeDefinitionKey[];
  changedVariants: string[];
  totalChanges: number;
  lines: string[];
};

export type StructuredCompanyNumberingPreview = {
  key: CompanyCodeDefinitionKey;
  variantId: string;
  preview: string;
  issues: ValidationIssue[];
};

type StoredCompanyCodeFormatRecord = {
  schemaVersion: number;
  savedAt: string;
  savedBy?: string | null;
  definition: CodeFormatDefinition;
};

const sequenceRuleSchema = z.object({
  namespace: z.string().trim().min(1).max(160),
  startAt: z.number().int().min(0).max(999999999),
  zeroPadding: z.number().int().min(1).max(12),
  resetPolicy: z.nativeEnum(NumberSeriesResetPolicy),
  scope: z.enum(sequenceScopes),
});

const tokenDefinitionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(tokenKinds),
  label: z.string().trim().min(1).max(120),
  required: z.boolean(),
  staticValue: z.string().trim().max(32).nullable().optional(),
  separator: z.string().trim().max(6).nullable().optional(),
  yearFormat: z.enum(["YY", "YYYY"]).nullable().optional(),
  sequenceRule: sequenceRuleSchema.nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

const codeFormatVariantSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  kind: z.enum(codeFormatVariantKinds),
  enabled: z.boolean(),
  notes: z.string().trim().max(500).nullable().optional(),
  primarySequenceTokenId: z.string().trim().min(1).max(120).nullable(),
  tokens: z.array(tokenDefinitionSchema).min(1),
});

const codeFormatDefinitionSchema = z.object({
  key: z.enum(companyCodeDefinitionKeys),
  internalKey: z.enum(companyCodeDefinitionKeys),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  enabled: z.boolean(),
  adminNotes: z.string().trim().max(1000).nullable().optional(),
  activeVariantId: z.string().trim().min(1).max(120),
  effectiveDate: z.string().trim().max(60).nullable().optional(),
  updatedAt: z.string().trim().max(60).nullable().optional(),
  updatedBy: z.string().trim().max(200).nullable().optional(),
  version: z.number().int().min(1).max(999),
  variants: z.array(codeFormatVariantSchema).min(1),
});

const storedCompanyCodeFormatRecordSchema = z.object({
  schemaVersion: z.number().int().min(1).max(999),
  savedAt: z.string().trim().min(1).max(60),
  savedBy: z.string().trim().max(200).nullable().optional(),
  definition: codeFormatDefinitionSchema,
});

const companyCodeFormatSettingsEnvelopeSchema = z.object({
  version: z.number().int().min(1).max(999),
  companyId: z.string().trim().min(1).nullable().optional(),
  source: z.enum(["stored", "derived-flat", "ygen-defaults"]),
  warnings: z.array(z.string().trim().min(1).max(500)).default([]),
  updatedAt: z.string().trim().max(60).nullable().optional(),
  updatedBy: z.string().trim().max(200).nullable().optional(),
  definitions: z.array(codeFormatDefinitionSchema).length(companyCodeDefinitionKeys.length),
});

export const defaultPreviewInput: PreviewInput = {
  clientShortCode: "ABG",
  offerNumber: 1098,
  budgetaryOfferNumber: 1,
  spotSaleOfferNumber: 5,
  quoteMonth: "02",
  quoteYear: "26",
  deliveryMonth: "01",
  deliveryYear: "26",
  invoiceMonth: "02",
  invoiceYear: "26",
  salespersonInitials: "RS",
  revisionNumber: 0,
  serialNumber: 13,
  projectSerialNumber: 1,
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildSequenceRule(input: SequenceRule): SequenceRule {
  return { ...input };
}

function staticToken(
  id: string,
  label: string,
  value: string,
  input?: Partial<TokenDefinition>,
): TokenDefinition {
  return {
    id,
    kind: "STATIC",
    label,
    required: input?.required ?? true,
    staticValue: value,
    separator: null,
    yearFormat: null,
    sequenceRule: null,
    notes: input?.notes ?? null,
  };
}

function separatorToken(id: string, value = "."): TokenDefinition {
  return {
    id,
    kind: "SEPARATOR",
    label: "Separator",
    required: true,
    staticValue: null,
    separator: value,
    yearFormat: null,
    sequenceRule: null,
    notes: null,
  };
}

function numberToken(
  id: string,
  kind: "OFFER_NUMBER" | "REVISION_NUMBER" | "SERIAL_NUMBER",
  label: string,
  sequenceRule: SequenceRule,
  input?: Partial<TokenDefinition>,
): TokenDefinition {
  return {
    id,
    kind,
    label,
    required: input?.required ?? true,
    staticValue: null,
    separator: null,
    yearFormat: null,
    sequenceRule: buildSequenceRule(sequenceRule),
    notes: input?.notes ?? null,
  };
}

function valueToken(
  id: string,
  kind:
    | "CLIENT_SHORT_CODE"
    | "QUOTE_MONTH"
    | "QUOTE_YEAR"
    | "DELIVERY_MONTH"
    | "DELIVERY_YEAR"
    | "INVOICE_MONTH"
    | "INVOICE_YEAR"
    | "SALESPERSON_INITIALS",
  label: string,
  input?: Partial<TokenDefinition>,
): TokenDefinition {
  return {
    id,
    kind,
    label,
    required: input?.required ?? true,
    staticValue: null,
    separator: null,
    yearFormat:
      kind === "QUOTE_YEAR" || kind === "DELIVERY_YEAR" || kind === "INVOICE_YEAR"
        ? input?.yearFormat ?? "YY"
        : null,
    sequenceRule: null,
    notes: input?.notes ?? null,
  };
}

function defaultSequenceNamespace(key: CompanyCodeDefinitionKey, variantId: string, kind: TokenKind): string {
  return `${key.toLowerCase()}.${variantId}.${kind.toLowerCase()}`;
}

function buildDefaultDefinition(key: CompanyCodeDefinitionKey): CodeFormatDefinition {
  switch (key) {
    case "QUOTATION":
      return {
        key,
        internalKey: key,
        displayName: "Active Quote Code",
        description: "YGEN active offer numbering with yearly offer reset, salesperson initials, and revision token.",
        enabled: true,
        adminNotes: null,
        activeVariantId: "standard",
        effectiveDate: null,
        updatedAt: null,
        updatedBy: null,
        version: companyCodeSettingsVersion,
        variants: [
          {
            id: "standard",
            label: "Standard",
            description: "Active offer: YAO.1098.ABG.02.26.RS.R0",
            kind: "STANDARD",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "offer-number",
            tokens: [
              staticToken("prefix", "Prefix", "YAO"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "standard", "OFFER_NUMBER"),
                startAt: 1000,
                zeroPadding: 4,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("quote-month", "QUOTE_MONTH", "Quote Month"),
              separatorToken("separator-4"),
              valueToken("quote-year", "QUOTE_YEAR", "Quote Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              valueToken("salesperson-initials", "SALESPERSON_INITIALS", "Salesperson Initials"),
              separatorToken("separator-6"),
              numberToken("revision-number", "REVISION_NUMBER", "Revision", {
                namespace: defaultSequenceNamespace(key, "standard", "REVISION_NUMBER"),
                startAt: 0,
                zeroPadding: 1,
                resetPolicy: NumberSeriesResetPolicy.NEVER,
                scope: "COMPANY",
              }),
            ],
          },
        ],
      };
    case "BUDGETARY":
      return {
        key,
        internalKey: key,
        displayName: "Budgetary Code",
        description: "Budgetary offer numbering with its own sequence and no revision token by default.",
        enabled: true,
        adminNotes: null,
        activeVariantId: "standard",
        effectiveDate: null,
        updatedAt: null,
        updatedBy: null,
        version: companyCodeSettingsVersion,
        variants: [
          {
            id: "standard",
            label: "Standard",
            description: "Budgetary offer: YBO.001.POCL.05.25.KR",
            kind: "STANDARD",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "offer-number",
            tokens: [
              staticToken("prefix", "Prefix", "YBO"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "standard", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("quote-month", "QUOTE_MONTH", "Quote Month"),
              separatorToken("separator-4"),
              valueToken("quote-year", "QUOTE_YEAR", "Quote Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              valueToken("salesperson-initials", "SALESPERSON_INITIALS", "Salesperson Initials"),
            ],
          },
        ],
      };
    case "DELIVERY_CHALLAN":
      return {
        key,
        internalKey: key,
        displayName: "Delivery Challan Code",
        description: "Support standard, previous-year quotation, and project challan variants without changing current live issuance yet.",
        enabled: true,
        adminNotes: null,
        activeVariantId: "standard",
        effectiveDate: null,
        updatedAt: null,
        updatedBy: null,
        version: companyCodeSettingsVersion,
        variants: [
          {
            id: "standard",
            label: "Standard",
            description: "Current-year challan: YAO.061.CEOL.01.26.DC-013",
            kind: "STANDARD",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "serial-number",
            tokens: [
              staticToken("prefix", "Prefix", "YAO"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "standard", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("delivery-month", "DELIVERY_MONTH", "Delivery Month"),
              separatorToken("separator-4"),
              valueToken("delivery-year", "DELIVERY_YEAR", "Delivery Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              staticToken("challan-prefix", "Document Prefix", "DC-"),
              numberToken("serial-number", "SERIAL_NUMBER", "Serial Number", {
                namespace: defaultSequenceNamespace(key, "standard", "SERIAL_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
            ],
          },
          {
            id: "previous-year",
            label: "Previous-Year Quotation",
            description: "Carry quote month/year, then append current delivery month/year and challan serial.",
            kind: "PREVIOUS_YEAR",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "serial-number",
            tokens: [
              staticToken("prefix", "Prefix", "YAO"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "previous-year", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("quote-month", "QUOTE_MONTH", "Quote Month"),
              separatorToken("separator-4"),
              valueToken("quote-year", "QUOTE_YEAR", "Quote Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              valueToken("delivery-month", "DELIVERY_MONTH", "Delivery Month"),
              separatorToken("separator-6"),
              valueToken("delivery-year", "DELIVERY_YEAR", "Delivery Year", { yearFormat: "YY" }),
              separatorToken("separator-7"),
              staticToken("challan-prefix", "Document Prefix", "DC-"),
              numberToken("serial-number", "SERIAL_NUMBER", "Serial Number", {
                namespace: defaultSequenceNamespace(key, "previous-year", "SERIAL_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
            ],
          },
          {
            id: "project",
            label: "Project",
            description: "Project challan with project-scoped serials: YAO.957.ORLL.DC-01",
            kind: "PROJECT",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "serial-number",
            tokens: [
              staticToken("prefix", "Prefix", "YAO"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "project", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              staticToken("challan-prefix", "Document Prefix", "DC-"),
              numberToken("serial-number", "SERIAL_NUMBER", "Project Serial", {
                namespace: defaultSequenceNamespace(key, "project", "SERIAL_NUMBER"),
                startAt: 1,
                zeroPadding: 2,
                resetPolicy: NumberSeriesResetPolicy.NEVER,
                scope: "PROJECT",
              }),
            ],
          },
        ],
      };
    case "INVOICE":
      return {
        key,
        internalKey: key,
        displayName: "Invoice Code",
        description: "Standard and previous-year invoice variants, plus a project-ready variant kept disabled by default.",
        enabled: true,
        adminNotes: null,
        activeVariantId: "standard",
        effectiveDate: null,
        updatedAt: null,
        updatedBy: null,
        version: companyCodeSettingsVersion,
        variants: [
          {
            id: "standard",
            label: "Standard",
            description: "Current-year invoice: YAO.1071.FW.01.26.INV-015",
            kind: "STANDARD",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "serial-number",
            tokens: [
              staticToken("prefix", "Prefix", "YAO"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "standard", "OFFER_NUMBER"),
                startAt: 1000,
                zeroPadding: 4,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("invoice-month", "INVOICE_MONTH", "Invoice Month"),
              separatorToken("separator-4"),
              valueToken("invoice-year", "INVOICE_YEAR", "Invoice Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              staticToken("invoice-prefix", "Document Prefix", "INV-"),
              numberToken("serial-number", "SERIAL_NUMBER", "Serial Number", {
                namespace: defaultSequenceNamespace(key, "standard", "SERIAL_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
            ],
          },
          {
            id: "previous-year",
            label: "Previous-Year Quotation",
            description: "Keep quote month/year and append current invoice month/year with a separate invoice serial.",
            kind: "PREVIOUS_YEAR",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "serial-number",
            tokens: [
              staticToken("prefix", "Prefix", "YAO"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "previous-year", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("quote-month", "QUOTE_MONTH", "Quote Month"),
              separatorToken("separator-4"),
              valueToken("quote-year", "QUOTE_YEAR", "Quote Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              valueToken("invoice-month", "INVOICE_MONTH", "Invoice Month"),
              separatorToken("separator-6"),
              valueToken("invoice-year", "INVOICE_YEAR", "Invoice Year", { yearFormat: "YY" }),
              separatorToken("separator-7"),
              staticToken("invoice-prefix", "Document Prefix", "INV-"),
              numberToken("serial-number", "SERIAL_NUMBER", "Serial Number", {
                namespace: defaultSequenceNamespace(key, "previous-year", "SERIAL_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
            ],
          },
          {
            id: "project",
            label: "Project Placeholder",
            description: "Reserved for project invoicing in phase 2.",
            kind: "PROJECT",
            enabled: false,
            notes: "Placeholder for future project-specific issuance.",
            primarySequenceTokenId: "serial-number",
            tokens: [
              staticToken("prefix", "Prefix", "YAO"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "project", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              staticToken("invoice-prefix", "Document Prefix", "INV-"),
              numberToken("serial-number", "SERIAL_NUMBER", "Project Serial", {
                namespace: defaultSequenceNamespace(key, "project", "SERIAL_NUMBER"),
                startAt: 1,
                zeroPadding: 2,
                resetPolicy: NumberSeriesResetPolicy.NEVER,
                scope: "PROJECT",
              }),
            ],
          },
        ],
      };
    case "SPOT_SALE":
      return {
        key,
        internalKey: key,
        displayName: "Spot Sale Codes",
        description: "Keep separate offer, challan, and invoice spot-sale variants so counters do not collide silently.",
        enabled: true,
        adminNotes: null,
        activeVariantId: "offer",
        effectiveDate: null,
        updatedAt: null,
        updatedBy: null,
        version: companyCodeSettingsVersion,
        variants: [
          {
            id: "offer",
            label: "Offer",
            description: "Spot sale offer: YGS.005.POCL.01.26.KR",
            kind: "SPOT_OFFER",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "offer-number",
            tokens: [
              staticToken("prefix", "Prefix", "YGS"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "offer", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("quote-month", "QUOTE_MONTH", "Quote Month"),
              separatorToken("separator-4"),
              valueToken("quote-year", "QUOTE_YEAR", "Quote Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              valueToken("salesperson-initials", "SALESPERSON_INITIALS", "Salesperson Initials"),
            ],
          },
          {
            id: "challan",
            label: "Delivery Challan",
            description: "Spot sale challan: YGS.005.POCL.01.26.DC-01",
            kind: "SPOT_CHALLAN",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "serial-number",
            tokens: [
              staticToken("prefix", "Prefix", "YGS"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "challan", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("delivery-month", "DELIVERY_MONTH", "Delivery Month"),
              separatorToken("separator-4"),
              valueToken("delivery-year", "DELIVERY_YEAR", "Delivery Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              staticToken("challan-prefix", "Document Prefix", "DC-"),
              numberToken("serial-number", "SERIAL_NUMBER", "Serial Number", {
                namespace: defaultSequenceNamespace(key, "challan", "SERIAL_NUMBER"),
                startAt: 1,
                zeroPadding: 2,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
            ],
          },
          {
            id: "invoice",
            label: "Invoice",
            description: "Spot sale invoice: YGS.005.POCL.01.26.INV-01",
            kind: "SPOT_INVOICE",
            enabled: true,
            notes: null,
            primarySequenceTokenId: "serial-number",
            tokens: [
              staticToken("prefix", "Prefix", "YGS"),
              separatorToken("separator-1"),
              numberToken("offer-number", "OFFER_NUMBER", "Offer Number", {
                namespace: defaultSequenceNamespace(key, "invoice", "OFFER_NUMBER"),
                startAt: 1,
                zeroPadding: 3,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
              separatorToken("separator-2"),
              valueToken("client-short-code", "CLIENT_SHORT_CODE", "Client Short Code"),
              separatorToken("separator-3"),
              valueToken("invoice-month", "INVOICE_MONTH", "Invoice Month"),
              separatorToken("separator-4"),
              valueToken("invoice-year", "INVOICE_YEAR", "Invoice Year", { yearFormat: "YY" }),
              separatorToken("separator-5"),
              staticToken("invoice-prefix", "Document Prefix", "INV-"),
              numberToken("serial-number", "SERIAL_NUMBER", "Serial Number", {
                namespace: defaultSequenceNamespace(key, "invoice", "SERIAL_NUMBER"),
                startAt: 1,
                zeroPadding: 2,
                resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
                scope: "YEARLY",
              }),
            ],
          },
        ],
      };
  }
}

export function getYgenDefaultCodeFormats(): CodeFormatDefinition[] {
  return companyCodeDefinitionKeys.map((key) => deepClone(buildDefaultDefinition(key)));
}

export function loadYgenDefaults(companyId?: string | null): CompanyCodeFormatSettingsEnvelope {
  return {
    version: companyCodeSettingsVersion,
    companyId: companyId ?? null,
    source: "ygen-defaults",
    warnings: [],
    updatedAt: null,
    updatedBy: null,
    definitions: getYgenDefaultCodeFormats(),
  };
}

export function getDefaultSampleCodeInputs(): PreviewInput {
  return deepClone(defaultPreviewInput);
}

export function cloneCompanyCodeSettingsEnvelope(
  envelope: CompanyCodeFormatSettingsEnvelope,
): CompanyCodeFormatSettingsEnvelope {
  return deepClone(envelope);
}

export function normalizeClientShortCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function normalizeInitials(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
}

function normalizeMonth(value: string): string {
  const numeric = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 12) {
    return value.trim();
  }
  return String(numeric).padStart(2, "0");
}

function normalizeYear(value: string, format: "YY" | "YYYY"): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return trimmed;
  if (format === "YYYY") {
    return digits.padStart(4, "20").slice(-4);
  }
  return digits.slice(-2).padStart(2, "0");
}

function padNumber(value: number, padding: number): string {
  return String(Math.max(0, Math.trunc(value))).padStart(Math.max(1, padding), "0");
}

function resolveTokenSampleValue(
  definition: CodeFormatDefinition,
  variant: CodeFormatVariant,
  token: TokenDefinition,
  input: PreviewInput,
): string {
  switch (token.kind) {
    case "STATIC":
      return token.staticValue ?? "";
    case "SEPARATOR":
      return token.separator ?? ".";
    case "OFFER_NUMBER": {
      const raw =
        definition.key === "BUDGETARY"
          ? input.budgetaryOfferNumber
          : definition.key === "SPOT_SALE"
            ? input.spotSaleOfferNumber
            : input.offerNumber;
      const padding = token.sequenceRule?.zeroPadding ?? 1;
      return padNumber(raw, padding);
    }
    case "SERIAL_NUMBER": {
      const value = variant.kind === "PROJECT" ? input.projectSerialNumber : input.serialNumber;
      const padding = token.sequenceRule?.zeroPadding ?? 1;
      return padNumber(value, padding);
    }
    case "REVISION_NUMBER": {
      const padding = token.sequenceRule?.zeroPadding ?? 1;
      return `R${padNumber(input.revisionNumber, padding)}`;
    }
    case "CLIENT_SHORT_CODE":
      return normalizeClientShortCode(input.clientShortCode);
    case "QUOTE_MONTH":
      return normalizeMonth(input.quoteMonth);
    case "DELIVERY_MONTH":
      return normalizeMonth(input.deliveryMonth);
    case "INVOICE_MONTH":
      return normalizeMonth(input.invoiceMonth);
    case "QUOTE_YEAR":
      return normalizeYear(input.quoteYear, token.yearFormat ?? "YY");
    case "DELIVERY_YEAR":
      return normalizeYear(input.deliveryYear, token.yearFormat ?? "YY");
    case "INVOICE_YEAR":
      return normalizeYear(input.invoiceYear, token.yearFormat ?? "YY");
    case "SALESPERSON_INITIALS":
      return normalizeInitials(input.salespersonInitials);
  }
}

export function buildCodeFromTokens(
  definition: CodeFormatDefinition,
  variant: CodeFormatVariant,
  input: PreviewInput,
): string {
  return variant.tokens.map((token) => resolveTokenSampleValue(definition, variant, token, input)).join("");
}

export function formatCodePreview(
  definition: CodeFormatDefinition,
  variantId?: string,
  input?: Partial<PreviewInput>,
): string {
  const variant =
    definition.variants.find((entry) => entry.id === (variantId ?? definition.activeVariantId)) ??
    definition.variants[0];
  if (!variant) return "";
  return buildCodeFromTokens(definition, variant, { ...defaultPreviewInput, ...input });
}

function allowedKindsForVariant(variantKind: CodeFormatVariantKind): TokenKind[] {
  switch (variantKind) {
    case "STANDARD":
      return [
        "STATIC",
        "SEPARATOR",
        "OFFER_NUMBER",
        "CLIENT_SHORT_CODE",
        "QUOTE_MONTH",
        "QUOTE_YEAR",
        "DELIVERY_MONTH",
        "DELIVERY_YEAR",
        "INVOICE_MONTH",
        "INVOICE_YEAR",
        "SALESPERSON_INITIALS",
        "REVISION_NUMBER",
        "SERIAL_NUMBER",
      ];
    case "PREVIOUS_YEAR":
      return [
        "STATIC",
        "SEPARATOR",
        "OFFER_NUMBER",
        "CLIENT_SHORT_CODE",
        "QUOTE_MONTH",
        "QUOTE_YEAR",
        "DELIVERY_MONTH",
        "DELIVERY_YEAR",
        "INVOICE_MONTH",
        "INVOICE_YEAR",
        "SERIAL_NUMBER",
      ];
    case "PROJECT":
      return ["STATIC", "SEPARATOR", "OFFER_NUMBER", "CLIENT_SHORT_CODE", "SERIAL_NUMBER"];
    case "SPOT_OFFER":
      return [
        "STATIC",
        "SEPARATOR",
        "OFFER_NUMBER",
        "CLIENT_SHORT_CODE",
        "QUOTE_MONTH",
        "QUOTE_YEAR",
        "SALESPERSON_INITIALS",
      ];
    case "SPOT_CHALLAN":
      return [
        "STATIC",
        "SEPARATOR",
        "OFFER_NUMBER",
        "CLIENT_SHORT_CODE",
        "DELIVERY_MONTH",
        "DELIVERY_YEAR",
        "SERIAL_NUMBER",
      ];
    case "SPOT_INVOICE":
      return [
        "STATIC",
        "SEPARATOR",
        "OFFER_NUMBER",
        "CLIENT_SHORT_CODE",
        "INVOICE_MONTH",
        "INVOICE_YEAR",
        "SERIAL_NUMBER",
      ];
  }
}

function requiredKindsForDefinition(
  definition: CodeFormatDefinition,
  variant: CodeFormatVariant,
): TokenKind[] {
  if (definition.key === "QUOTATION") {
    return [
      "OFFER_NUMBER",
      "CLIENT_SHORT_CODE",
      "QUOTE_MONTH",
      "QUOTE_YEAR",
      "SALESPERSON_INITIALS",
      "REVISION_NUMBER",
    ];
  }
  if (definition.key === "BUDGETARY") {
    return [
      "OFFER_NUMBER",
      "CLIENT_SHORT_CODE",
      "QUOTE_MONTH",
      "QUOTE_YEAR",
      "SALESPERSON_INITIALS",
    ];
  }
  if (definition.key === "DELIVERY_CHALLAN") {
    if (variant.kind === "PREVIOUS_YEAR") {
      return [
        "OFFER_NUMBER",
        "CLIENT_SHORT_CODE",
        "QUOTE_MONTH",
        "QUOTE_YEAR",
        "DELIVERY_MONTH",
        "DELIVERY_YEAR",
        "SERIAL_NUMBER",
      ];
    }
    if (variant.kind === "PROJECT") {
      return ["OFFER_NUMBER", "CLIENT_SHORT_CODE", "SERIAL_NUMBER"];
    }
    return ["OFFER_NUMBER", "CLIENT_SHORT_CODE", "DELIVERY_MONTH", "DELIVERY_YEAR", "SERIAL_NUMBER"];
  }
  if (definition.key === "INVOICE") {
    if (variant.kind === "PREVIOUS_YEAR") {
      return [
        "OFFER_NUMBER",
        "CLIENT_SHORT_CODE",
        "QUOTE_MONTH",
        "QUOTE_YEAR",
        "INVOICE_MONTH",
        "INVOICE_YEAR",
        "SERIAL_NUMBER",
      ];
    }
    if (variant.kind === "PROJECT") {
      return ["OFFER_NUMBER", "CLIENT_SHORT_CODE", "SERIAL_NUMBER"];
    }
    return ["OFFER_NUMBER", "CLIENT_SHORT_CODE", "INVOICE_MONTH", "INVOICE_YEAR", "SERIAL_NUMBER"];
  }
  if (definition.key === "SPOT_SALE") {
    if (variant.kind === "SPOT_OFFER") {
      return [
        "OFFER_NUMBER",
        "CLIENT_SHORT_CODE",
        "QUOTE_MONTH",
        "QUOTE_YEAR",
        "SALESPERSON_INITIALS",
      ];
    }
    if (variant.kind === "SPOT_CHALLAN") {
      return ["OFFER_NUMBER", "CLIENT_SHORT_CODE", "DELIVERY_MONTH", "DELIVERY_YEAR", "SERIAL_NUMBER"];
    }
    return ["OFFER_NUMBER", "CLIENT_SHORT_CODE", "INVOICE_MONTH", "INVOICE_YEAR", "SERIAL_NUMBER"];
  }
  return [];
}

function tokenOrderWeight(kind: TokenKind): number {
  switch (kind) {
    case "STATIC":
    case "SEPARATOR":
      return 0;
    case "OFFER_NUMBER":
      return 10;
    case "CLIENT_SHORT_CODE":
      return 20;
    case "QUOTE_MONTH":
      return 30;
    case "QUOTE_YEAR":
      return 31;
    case "DELIVERY_MONTH":
    case "INVOICE_MONTH":
      return 40;
    case "DELIVERY_YEAR":
    case "INVOICE_YEAR":
      return 41;
    case "SALESPERSON_INITIALS":
      return 50;
    case "REVISION_NUMBER":
    case "SERIAL_NUMBER":
      return 60;
  }
}

function sequenceTokensForVariant(variant: CodeFormatVariant): TokenDefinition[] {
  return variant.tokens.filter((token) => Boolean(token.sequenceRule));
}

function findPrimaryVariant(definition: CodeFormatDefinition): CodeFormatVariant | null {
  return (
    definition.variants.find((variant) => variant.id === definition.activeVariantId) ??
    definition.variants.find((variant) => variant.enabled) ??
    definition.variants[0] ??
    null
  );
}

function fallbackCompatibilityPrefix(key: CompanyCodeDefinitionKey): string {
  switch (key) {
    case "QUOTATION":
      return "QTN";
    case "BUDGETARY":
      return "BGT";
    case "DELIVERY_CHALLAN":
      return "DCH";
    case "INVOICE":
      return "INV";
    case "SPOT_SALE":
      return "POS";
  }
}

function compatibilityPrefixFromVariant(definition: CodeFormatDefinition, variant: CodeFormatVariant): string {
  const firstStatic = variant.tokens.find((token) => token.kind === "STATIC" && token.staticValue?.trim());
  const prefix = firstStatic?.staticValue?.trim().replace(/[^A-Za-z0-9-]/g, "");
  return prefix && prefix.length > 0 ? prefix : fallbackCompatibilityPrefix(definition.key);
}

export function getSequenceScopeKey(
  sequenceRule: SequenceRule,
  input?: { companyId?: string | null; projectId?: string | null; year?: string | null },
): string {
  switch (sequenceRule.scope) {
    case "PROJECT":
      return `project:${input?.projectId ?? "project"}`;
    case "YEARLY":
      return `year:${input?.year ?? "YYYY"}`;
    case "GLOBAL":
      return "global";
    case "COMPANY":
    default:
      return `company:${input?.companyId ?? "company"}`;
  }
}

export function getCompatibilityProjection(definition: CodeFormatDefinition): Pick<
  CompanyCodeFormatConfig,
  "pattern" | "resetPolicy" | "startAt" | "padding" | "isActive"
> {
  const variant = findPrimaryVariant(definition);
  const sequenceToken =
    variant?.tokens.find((token) => token.id === variant.primarySequenceTokenId) ??
    variant?.tokens.find((token) => Boolean(token.sequenceRule)) ??
    null;
  const rule = sequenceToken?.sequenceRule ?? {
    namespace: `${definition.key.toLowerCase()}.compatibility`,
    startAt: 1,
    zeroPadding: 4,
    resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
    scope: "YEARLY" as SequenceScope,
  };
  const prefix = variant ? compatibilityPrefixFromVariant(definition, variant) : fallbackCompatibilityPrefix(definition.key);
  const sequenceTokenPattern = `{${"#".repeat(Math.max(1, rule.zeroPadding))}}`;
  const patternParts = [prefix];
  if (rule.resetPolicy === NumberSeriesResetPolicy.FISCAL_YEAR) {
    patternParts.push("{FY}");
  } else if (
    rule.resetPolicy === NumberSeriesResetPolicy.CALENDAR_YEAR ||
    rule.resetPolicy === NumberSeriesResetPolicy.MONTHLY
  ) {
    patternParts.push("{YYYY}");
  }
  patternParts.push("{COMP}");
  patternParts.push(sequenceTokenPattern);

  return {
    pattern: patternParts.join("-"),
    resetPolicy: rule.resetPolicy,
    startAt: rule.startAt,
    padding: rule.zeroPadding,
    isActive: definition.enabled,
  };
}

function extractPrefixFromPattern(pattern: string): string | null {
  const beforeToken = pattern.split("{")[0]?.trim() ?? "";
  const normalized = beforeToken.replace(/[-._]+$/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}

function applyLegacyProjectionToDefinition(
  definition: CodeFormatDefinition,
  flatConfig: CompanyCodeFormatConfig,
): CodeFormatDefinition {
  const next = deepClone(definition);
  next.enabled = flatConfig.isActive;
  const activeVariant = findPrimaryVariant(next);
  if (activeVariant) {
    const prefix = extractPrefixFromPattern(flatConfig.pattern);
    const firstStatic = activeVariant.tokens.find((token) => token.kind === "STATIC");
    if (prefix && firstStatic) {
      firstStatic.staticValue = prefix;
    }
    const sequenceToken =
      activeVariant.tokens.find((token) => token.id === activeVariant.primarySequenceTokenId) ??
      activeVariant.tokens.find((token) => Boolean(token.sequenceRule));
    if (sequenceToken?.sequenceRule) {
      sequenceToken.sequenceRule.startAt = flatConfig.startAt;
      sequenceToken.sequenceRule.zeroPadding = flatConfig.padding;
      sequenceToken.sequenceRule.resetPolicy = flatConfig.resetPolicy;
      sequenceToken.sequenceRule.scope =
        flatConfig.resetPolicy === NumberSeriesResetPolicy.NEVER
          ? "COMPANY"
          : flatConfig.resetPolicy === NumberSeriesResetPolicy.CALENDAR_YEAR ||
              flatConfig.resetPolicy === NumberSeriesResetPolicy.FISCAL_YEAR
            ? "YEARLY"
            : "GLOBAL";
    }
  }
  return next;
}

export function deriveDefinitionFromFlatFormat(
  flatConfig: CompanyCodeFormatConfig,
): CodeFormatDefinition | null {
  if (!companyCodeDefinitionKeys.includes(flatConfig.key as CompanyCodeDefinitionKey)) {
    return null;
  }
  const definition = buildDefaultDefinition(flatConfig.key as CompanyCodeDefinitionKey);
  return applyLegacyProjectionToDefinition(definition, flatConfig);
}

export function serializeCodeFormatConfig(
  definition: CodeFormatDefinition,
  input?: { savedAt?: string; savedBy?: string | null },
): StoredCompanyCodeFormatRecord {
  return {
    schemaVersion: companyCodeSettingsVersion,
    savedAt: input?.savedAt ?? new Date().toISOString(),
    savedBy: input?.savedBy ?? null,
    definition: deepClone(definition),
  };
}

export function deserializeCodeFormatConfig(value: unknown): StoredCompanyCodeFormatRecord | null {
  const parsed = storedCompanyCodeFormatRecordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function buildSettingsEnvelopeFromDefinitions(input: {
  companyId?: string | null;
  definitions: CodeFormatDefinition[];
  source?: CompanyCodeFormatSettingsEnvelope["source"];
  warnings?: string[];
  updatedAt?: string | null;
  updatedBy?: string | null;
}): CompanyCodeFormatSettingsEnvelope {
  return {
    version: companyCodeSettingsVersion,
    companyId: input.companyId ?? null,
    source: input.source ?? "stored",
    warnings: input.warnings ?? [],
    updatedAt: input.updatedAt ?? null,
    updatedBy: input.updatedBy ?? null,
    definitions: companyCodeDefinitionKeys.map((key) => {
      const match = input.definitions.find((definition) => definition.key === key);
      return match ? deepClone(match) : buildDefaultDefinition(key);
    }),
  };
}

export function parseSettingsEnvelope(value: unknown): CompanyCodeFormatSettingsEnvelope | null {
  const parsed = companyCodeFormatSettingsEnvelopeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseCodeFormatDefinition(value: unknown): CodeFormatDefinition | null {
  const parsed = codeFormatDefinitionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function createDefaultTokenDefinition(
  kind: TokenKind,
  input: { key: CompanyCodeDefinitionKey; variantId: string; index: number },
): TokenDefinition {
  switch (kind) {
    case "STATIC":
      return staticToken(`static-${input.index}`, "Static Text", "TXT");
    case "SEPARATOR":
      return separatorToken(`separator-${input.index}`);
    case "OFFER_NUMBER":
      return numberToken(`offer-number-${input.index}`, "OFFER_NUMBER", "Offer Number", {
        namespace: defaultSequenceNamespace(input.key, input.variantId, "OFFER_NUMBER"),
        startAt: 1,
        zeroPadding: 3,
        resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
        scope: "YEARLY",
      });
    case "REVISION_NUMBER":
      return numberToken(`revision-number-${input.index}`, "REVISION_NUMBER", "Revision", {
        namespace: defaultSequenceNamespace(input.key, input.variantId, "REVISION_NUMBER"),
        startAt: 0,
        zeroPadding: 1,
        resetPolicy: NumberSeriesResetPolicy.NEVER,
        scope: "COMPANY",
      });
    case "SERIAL_NUMBER":
      return numberToken(`serial-number-${input.index}`, "SERIAL_NUMBER", "Serial Number", {
        namespace: defaultSequenceNamespace(input.key, input.variantId, "SERIAL_NUMBER"),
        startAt: 1,
        zeroPadding: 2,
        resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
        scope: "YEARLY",
      });
    case "CLIENT_SHORT_CODE":
      return valueToken(`client-short-code-${input.index}`, "CLIENT_SHORT_CODE", "Client Short Code");
    case "QUOTE_MONTH":
      return valueToken(`quote-month-${input.index}`, "QUOTE_MONTH", "Quote Month");
    case "QUOTE_YEAR":
      return valueToken(`quote-year-${input.index}`, "QUOTE_YEAR", "Quote Year", { yearFormat: "YY" });
    case "DELIVERY_MONTH":
      return valueToken(`delivery-month-${input.index}`, "DELIVERY_MONTH", "Delivery Month");
    case "DELIVERY_YEAR":
      return valueToken(`delivery-year-${input.index}`, "DELIVERY_YEAR", "Delivery Year", { yearFormat: "YY" });
    case "INVOICE_MONTH":
      return valueToken(`invoice-month-${input.index}`, "INVOICE_MONTH", "Invoice Month");
    case "INVOICE_YEAR":
      return valueToken(`invoice-year-${input.index}`, "INVOICE_YEAR", "Invoice Year", { yearFormat: "YY" });
    case "SALESPERSON_INITIALS":
      return valueToken(`salesperson-initials-${input.index}`, "SALESPERSON_INITIALS", "Salesperson Initials");
  }
}

export function compareFormatConfigChanges(
  previous: CompanyCodeFormatSettingsEnvelope | null,
  next: CompanyCodeFormatSettingsEnvelope,
): ChangeSummary {
  if (!previous) {
    return {
      changedKeys: next.definitions.map((definition) => definition.key),
      changedVariants: next.definitions.flatMap((definition) =>
        definition.variants.map((variant) => `${definition.key}:${variant.id}`),
      ),
      totalChanges: next.definitions.length,
      lines: next.definitions.map((definition) => `${definition.displayName} added to the active configuration.`),
    };
  }

  const changedKeys: CompanyCodeDefinitionKey[] = [];
  const changedVariants = new Set<string>();
  const lines: string[] = [];

  for (const definition of next.definitions) {
    const previousDefinition = previous.definitions.find((entry) => entry.key === definition.key);
    if (!previousDefinition) {
      changedKeys.push(definition.key);
      lines.push(`${definition.displayName} was added.`);
      continue;
    }

    if (JSON.stringify(previousDefinition) !== JSON.stringify(definition)) {
      changedKeys.push(definition.key);
      lines.push(`${definition.displayName} was updated.`);
    }

    for (const variant of definition.variants) {
      const previousVariant = previousDefinition.variants.find((entry) => entry.id === variant.id);
      if (!previousVariant || JSON.stringify(previousVariant) !== JSON.stringify(variant)) {
        changedVariants.add(`${definition.key}:${variant.id}`);
      }
    }
  }

  return {
    changedKeys,
    changedVariants: [...changedVariants],
    totalChanges: lines.length,
    lines,
  };
}

export function validateCodeFormatDefinition(definition: CodeFormatDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activeVariantIds = new Set(definition.variants.map((variant) => variant.id));

  if (!activeVariantIds.has(definition.activeVariantId)) {
    issues.push({
      severity: "error",
      key: definition.key,
      field: "activeVariantId",
      message: "Active variant must reference an existing variant.",
    });
  }

  const enabledVariants = definition.variants.filter((variant) => variant.enabled);
  if (definition.enabled && enabledVariants.length === 0) {
    issues.push({
      severity: "error",
      key: definition.key,
      message: "At least one variant must remain enabled while the definition is enabled.",
    });
  }

  for (const variant of definition.variants) {
    const allowedKinds = new Set(allowedKindsForVariant(variant.kind));
    const requiredKinds = new Set(requiredKindsForDefinition(definition, variant));
    const seenKinds = new Set<TokenKind>();
    const seenNamespaces = new Set<string>();
    let previousWeight = 0;
    const firstNonSeparator = variant.tokens.find((token) => token.kind !== "SEPARATOR");

    if (!firstNonSeparator || firstNonSeparator.kind !== "STATIC") {
      issues.push({
        severity: "error",
        key: definition.key,
        variantId: variant.id,
        field: "tokens",
        message: "The first visible token should be a static prefix token.",
      });
    } else if (!/^[A-Z0-9-]+$/i.test(firstNonSeparator.staticValue ?? "")) {
      issues.push({
        severity: "warning",
        key: definition.key,
        variantId: variant.id,
        field: "tokens",
        message: "Prefix text should stay alphanumeric for clean ERP output.",
      });
    }

    if (variant.primarySequenceTokenId) {
      const primaryToken = variant.tokens.find((token) => token.id === variant.primarySequenceTokenId);
      if (!primaryToken?.sequenceRule) {
        issues.push({
          severity: "error",
          key: definition.key,
          variantId: variant.id,
          field: "primarySequenceTokenId",
          message: "Primary sequence token must point to a token with sequence settings.",
        });
      }
    }

    for (const token of variant.tokens) {
      if (!allowedKinds.has(token.kind)) {
        issues.push({
          severity: "error",
          key: definition.key,
          variantId: variant.id,
          field: "tokens",
          message: `${token.label} is not allowed in the ${variant.label} variant.`,
        });
      }

      if (token.kind !== "STATIC" && token.kind !== "SEPARATOR") {
        if (seenKinds.has(token.kind)) {
          issues.push({
            severity: "error",
            key: definition.key,
            variantId: variant.id,
            field: "tokens",
            message: `${token.label} appears more than once in ${variant.label}.`,
          });
        }
        seenKinds.add(token.kind);
      }

      const weight = tokenOrderWeight(token.kind);
      if (weight > 0 && weight < previousWeight) {
        issues.push({
          severity: "error",
          key: definition.key,
          variantId: variant.id,
          field: "tokens",
          message: `${token.label} is out of order for ${variant.label}.`,
        });
      }
      if (weight > 0) previousWeight = weight;

      if (token.sequenceRule) {
        if (token.sequenceRule.zeroPadding < 1 || token.sequenceRule.zeroPadding > 12) {
          issues.push({
            severity: "error",
            key: definition.key,
            variantId: variant.id,
            field: "sequenceRule.zeroPadding",
            message: `${token.label} padding must stay between 1 and 12.`,
          });
        }
        if (token.kind !== "REVISION_NUMBER" && token.sequenceRule.startAt < 1) {
          issues.push({
            severity: "error",
            key: definition.key,
            variantId: variant.id,
            field: "sequenceRule.startAt",
            message: `${token.label} start value must be at least 1.`,
          });
        }
        if (token.kind === "REVISION_NUMBER" && token.sequenceRule.startAt < 0) {
          issues.push({
            severity: "error",
            key: definition.key,
            variantId: variant.id,
            field: "sequenceRule.startAt",
            message: "Revision numbers cannot start below 0.",
          });
        }
        if (seenNamespaces.has(token.sequenceRule.namespace)) {
          issues.push({
            severity: "error",
            key: definition.key,
            variantId: variant.id,
            field: "sequenceRule.namespace",
            message: `Sequence namespace '${token.sequenceRule.namespace}' is duplicated inside ${variant.label}.`,
          });
        }
        seenNamespaces.add(token.sequenceRule.namespace);
      }

      if (
        (token.kind === "QUOTE_YEAR" || token.kind === "DELIVERY_YEAR" || token.kind === "INVOICE_YEAR") &&
        token.yearFormat !== "YY" &&
        token.yearFormat !== "YYYY"
      ) {
        issues.push({
          severity: "error",
          key: definition.key,
          variantId: variant.id,
          field: "yearFormat",
          message: `${token.label} must use a two-digit or four-digit year format.`,
        });
      }
    }

    for (const requiredKind of requiredKinds) {
      const present = variant.tokens.some((token) => token.kind === requiredKind);
      if (!present) {
        issues.push({
          severity: "error",
          key: definition.key,
          variantId: variant.id,
          field: "tokens",
          message: `${variant.label} is missing ${humanizeTokenKind(requiredKind)}.`,
        });
      }
    }

    const revisionTokenIndex = variant.tokens.findIndex((token) => token.kind === "REVISION_NUMBER");
    if (revisionTokenIndex >= 0) {
      const trailingSemanticToken = [...variant.tokens]
        .reverse()
        .find((token) => token.kind !== "SEPARATOR" && token.kind !== "STATIC");
      if (!trailingSemanticToken || trailingSemanticToken.kind !== "REVISION_NUMBER") {
        issues.push({
          severity: "error",
          key: definition.key,
          variantId: variant.id,
          field: "tokens",
          message: "Revision token must be the last semantic token.",
        });
      }
    }

    if (variant.kind === "PREVIOUS_YEAR") {
      const hasQuoteTokens = variant.tokens.some((token) => token.kind === "QUOTE_MONTH") &&
        variant.tokens.some((token) => token.kind === "QUOTE_YEAR");
      if (!hasQuoteTokens) {
        issues.push({
          severity: "error",
          key: definition.key,
          variantId: variant.id,
          field: "tokens",
          message: "Previous-year variants must keep quote month and quote year tokens.",
        });
      }
    }

    if (variant.kind === "PROJECT") {
      const hasProjectScopedToken = variant.tokens.some(
        (token) => token.sequenceRule?.scope === "PROJECT",
      );
      if (!hasProjectScopedToken) {
        issues.push({
          severity: "error",
          key: definition.key,
          variantId: variant.id,
          field: "sequenceRule.scope",
          message: "Project variants need at least one project-scoped sequence token.",
        });
      }
    }
  }

  return issues;
}

export function validateCodeFormatConfig(
  envelope: CompanyCodeFormatSettingsEnvelope,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const namespaceOwners = new Map<string, string>();

  for (const definition of envelope.definitions) {
    issues.push(...validateCodeFormatDefinition(definition));
    for (const variant of definition.variants) {
      for (const token of sequenceTokensForVariant(variant)) {
        const namespace = token.sequenceRule?.namespace?.trim();
        if (!namespace) continue;
        const owner = namespaceOwners.get(namespace);
        const currentOwner = `${definition.key}:${variant.id}:${token.id}`;
        if (owner && owner !== currentOwner) {
          issues.push({
            severity: "error",
            key: definition.key,
            variantId: variant.id,
            field: "sequenceRule.namespace",
            message: `Sequence namespace '${namespace}' collides with another format token.`,
          });
        } else {
          namespaceOwners.set(namespace, currentOwner);
        }
      }
    }
  }

  return issues;
}

export function humanizeTokenKind(kind: TokenKind): string {
  switch (kind) {
    case "STATIC":
      return "static text";
    case "SEPARATOR":
      return "separator";
    case "OFFER_NUMBER":
      return "offer number";
    case "CLIENT_SHORT_CODE":
      return "client short code";
    case "QUOTE_MONTH":
      return "quote month";
    case "QUOTE_YEAR":
      return "quote year";
    case "DELIVERY_MONTH":
      return "delivery month";
    case "DELIVERY_YEAR":
      return "delivery year";
    case "INVOICE_MONTH":
      return "invoice month";
    case "INVOICE_YEAR":
      return "invoice year";
    case "SALESPERSON_INITIALS":
      return "salesperson initials";
    case "REVISION_NUMBER":
      return "revision number";
    case "SERIAL_NUMBER":
      return "serial number";
  }
}

export function previewStructuredCompanyNumbering(input: {
  definition: CodeFormatDefinition;
  variantId: string;
  sample?: Partial<PreviewInput>;
}): StructuredCompanyNumberingPreview {
  const variant =
    input.definition.variants.find((entry) => entry.id === input.variantId) ??
    findPrimaryVariant(input.definition);
  const issues = validateCodeFormatDefinition(input.definition).filter(
    (issue) => !issue.variantId || issue.variantId === (variant?.id ?? input.variantId),
  );
  return {
    key: input.definition.key,
    variantId: variant?.id ?? input.variantId,
    preview: variant ? buildCodeFromTokens(input.definition, variant, { ...defaultPreviewInput, ...input.sample }) : "",
    issues,
  };
}

export function applyStoredMetadataToDefinition(
  flatConfig: CompanyCodeFormatConfig,
  metadata: unknown,
): { definition: CodeFormatDefinition; warning?: string } | null {
  const stored = deserializeCodeFormatConfig(metadata);
  if (!stored) {
    const derived = deriveDefinitionFromFlatFormat(flatConfig);
    return derived
      ? {
          definition: derived,
          warning: `Rich metadata for ${flatConfig.key} was missing or invalid. A safe draft was derived from the current compatibility pattern.`,
        }
      : null;
  }

  return {
    definition: applyLegacyProjectionToDefinition(stored.definition, flatConfig),
  };
}

export function flattenEnvelopeForPersistence(
  envelope: CompanyCodeFormatSettingsEnvelope,
): CompanyCodeFormatSettingsEnvelope {
  return parseSettingsEnvelope(envelope) ?? buildSettingsEnvelopeFromDefinitions({
    companyId: envelope.companyId,
    definitions: envelope.definitions,
    source: envelope.source,
    warnings: envelope.warnings,
    updatedAt: envelope.updatedAt,
    updatedBy: envelope.updatedBy,
  });
}

export function isCompanyCodeDefinitionKey(value: string): value is CompanyCodeDefinitionKey {
  return companyCodeDefinitionKeys.includes(value as CompanyCodeDefinitionKey);
}

export function asDefinitionKey(value: CompanyCodeFormatKey): CompanyCodeDefinitionKey | null {
  return isCompanyCodeDefinitionKey(value) ? value : null;
}
