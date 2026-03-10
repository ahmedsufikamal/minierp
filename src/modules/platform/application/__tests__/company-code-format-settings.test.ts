import { describe, expect, it } from "vitest";
import { NumberSeriesResetPolicy } from "@prisma/client";
import {
  applyStoredMetadataToDefinition,
  compareFormatConfigChanges,
  deriveDefinitionFromFlatFormat,
  formatCodePreview,
  getCompatibilityProjection,
  getYgenDefaultCodeFormats,
  loadYgenDefaults,
  normalizeClientShortCode,
  serializeCodeFormatConfig,
  validateCodeFormatConfig,
  type CompanyCodeFormatSettingsEnvelope,
} from "@/modules/platform/domain/company-code-format-settings";
import type { CompanyCodeFormatConfig } from "@/modules/platform/domain/company-numbering";

describe("company code format settings", () => {
  it("loads the full YGEN default definition set", () => {
    const definitions = getYgenDefaultCodeFormats();
    expect(definitions.map((definition) => definition.key)).toEqual([
      "QUOTATION",
      "BUDGETARY",
      "DELIVERY_CHALLAN",
      "INVOICE",
      "SPOT_SALE",
    ]);
  });

  it("renders active quote previews from tokens", () => {
    const quote = getYgenDefaultCodeFormats().find((definition) => definition.key === "QUOTATION");
    expect(quote).toBeTruthy();
    expect(formatCodePreview(quote!, "standard")).toBe("YAO.1098.ABG.02.26.RS.R0");
  });

  it("renders previous-year challan previews from tokens", () => {
    const challan = getYgenDefaultCodeFormats().find((definition) => definition.key === "DELIVERY_CHALLAN");
    expect(challan).toBeTruthy();
    expect(formatCodePreview(challan!, "previous-year", { offerNumber: 995, clientShortCode: "XCL", quoteMonth: "12", quoteYear: "25", deliveryMonth: "01", deliveryYear: "26", serialNumber: 6 })).toBe(
      "YAO.995.XCL.12.25.01.26.DC-006",
    );
  });

  it("renders spot-sale invoice previews without colliding with the spot offer namespace", () => {
    const spot = getYgenDefaultCodeFormats().find((definition) => definition.key === "SPOT_SALE");
    expect(spot).toBeTruthy();
    expect(formatCodePreview(spot!, "invoice", { clientShortCode: "POCL", spotSaleOfferNumber: 5, invoiceMonth: "01", invoiceYear: "26", serialNumber: 1 })).toBe(
      "YGS.005.POCL.01.26.INV-01",
    );
  });

  it("serializes and applies stored metadata back onto the flat row", () => {
    const quotation = getYgenDefaultCodeFormats().find((definition) => definition.key === "QUOTATION")!;
    const serialized = serializeCodeFormatConfig(quotation, {
      savedAt: "2026-03-10T12:00:00.000Z",
      savedBy: "owner@demo.local",
    });
    const flat: CompanyCodeFormatConfig = {
      key: "QUOTATION",
      name: "Quotation Code",
      pattern: "YAO-{YYYY}-{COMP}-{####}",
      resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
      startAt: 1000,
      padding: 4,
      isActive: true,
      metadata: {},
    };

    const applied = applyStoredMetadataToDefinition(flat, serialized);
    expect(applied?.definition.displayName).toBe("Active Quote Code");
    expect(applied?.definition.variants[0]?.tokens[0]?.staticValue).toBe("YAO");
  });

  it("derives a safe draft from legacy flat formats", () => {
    const derived = deriveDefinitionFromFlatFormat({
      key: "INVOICE",
      name: "Invoice Code",
      pattern: "INV-{YYYY}-{COMP}-{####}",
      resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
      startAt: 12,
      padding: 4,
      isActive: true,
      metadata: null,
    });

    expect(derived?.key).toBe("INVOICE");
    expect(getCompatibilityProjection(derived!).pattern).toContain("INV");
    expect(getCompatibilityProjection(derived!).padding).toBe(4);
  });

  it("flags invalid duplicate namespaces and missing project scopes", () => {
    const envelope: CompanyCodeFormatSettingsEnvelope = loadYgenDefaults("company-1");
    const delivery = envelope.definitions.find((definition) => definition.key === "DELIVERY_CHALLAN")!;
    const project = delivery.variants.find((variant) => variant.id === "project")!;
    const serial = project.tokens.find((token) => token.id === "serial-number")!;
    if (!serial.sequenceRule) {
      throw new Error("expected serial sequence");
    }
    serial.sequenceRule.scope = "COMPANY";
    serial.sequenceRule.namespace = "shared.namespace";
    const standardOffer = delivery.variants[0]?.tokens.find((token) => token.id === "offer-number");
    if (!standardOffer?.sequenceRule) {
      throw new Error("expected offer sequence");
    }
    standardOffer.sequenceRule.namespace = "shared.namespace";

    const issues = validateCodeFormatConfig(envelope);
    expect(issues.some((issue) => issue.message.includes("project-scoped sequence token"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("collides with another format token"))).toBe(true);
  });

  it("summarizes diffs between envelopes", () => {
    const previous = loadYgenDefaults("company-1");
    const next = loadYgenDefaults("company-1");
    next.definitions[0]!.displayName = "Quotes";

    const summary = compareFormatConfigChanges(previous, next);
    expect(summary.changedKeys).toEqual(["QUOTATION"]);
    expect(summary.totalChanges).toBe(1);
  });

  it("normalizes client short codes for preview safety", () => {
    expect(normalizeClientShortCode(" po-cl / ltd ")).toBe("POCLLT");
  });
});
