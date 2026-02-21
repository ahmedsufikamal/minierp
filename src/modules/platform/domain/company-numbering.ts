import { NumberSeriesResetPolicy } from "@prisma/client";

export const companyCodeFormatKeys = [
  "SKU",
  "QUOTATION",
  "DELIVERY_CHALLAN",
  "INVOICE",
  "SPOT_SALE",
  "BUDGETARY",
] as const;

export type CompanyCodeFormatKey = (typeof companyCodeFormatKeys)[number];

export type CompanyCodeFormatConfig = {
  key: CompanyCodeFormatKey;
  name: string;
  pattern: string;
  resetPolicy: NumberSeriesResetPolicy;
  startAt: number;
  padding: number;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
};

export type CompanyNumberingMasterConfig = {
  companyId: string;
  formats: CompanyCodeFormatConfig[];
};

export const companyCodeFormatDefaults: Record<CompanyCodeFormatKey, CompanyCodeFormatConfig> = {
  SKU: {
    key: "SKU",
    name: "SKU Number Format",
    pattern: "SKU-{COMP}-{####}",
    resetPolicy: NumberSeriesResetPolicy.NEVER,
    startAt: 1,
    padding: 4,
    isActive: true,
  },
  QUOTATION: {
    key: "QUOTATION",
    name: "Quotation Code",
    pattern: "QTN-{FY}-{COMP}-{####}",
    resetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    startAt: 1,
    padding: 4,
    isActive: true,
  },
  DELIVERY_CHALLAN: {
    key: "DELIVERY_CHALLAN",
    name: "Delivery Challan Code",
    pattern: "DCH-{FY}-{COMP}-{####}",
    resetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    startAt: 1,
    padding: 4,
    isActive: true,
  },
  INVOICE: {
    key: "INVOICE",
    name: "Invoice Code",
    pattern: "INV-{FY}-{COMP}-{####}",
    resetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    startAt: 1,
    padding: 4,
    isActive: true,
  },
  SPOT_SALE: {
    key: "SPOT_SALE",
    name: "Spot Sale Code",
    pattern: "POS-{FY}-{COMP}-{####}",
    resetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    startAt: 1,
    padding: 4,
    isActive: true,
  },
  BUDGETARY: {
    key: "BUDGETARY",
    name: "Budgetary Code",
    pattern: "BGT-{FY}-{COMP}-{####}",
    resetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    startAt: 1,
    padding: 4,
    isActive: true,
  },
};
