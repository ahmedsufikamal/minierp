import { describe, expect, it } from "vitest";
import { CustomFieldDataType, PlatformPermissionEffect } from "@prisma/client";
import {
  compileMetaPayload,
  validateCustomDataWithCompiledSchema,
} from "@/modules/platform/application/meta-compile.service";

describe("meta compile service", () => {
  it("builds deterministic compiled payload + etag", () => {
    const fields = [
      {
        fieldKey: "name",
        label: "Name",
        dataType: CustomFieldDataType.TEXT,
        required: true,
        readOnly: false,
        unique: false,
        sortOrder: 1,
        options: null,
        defaultValue: null,
        ui: null,
      },
      {
        fieldKey: "credit_limit",
        label: "Credit Limit",
        dataType: CustomFieldDataType.NUMBER,
        required: false,
        readOnly: false,
        unique: false,
        sortOrder: 2,
        options: null,
        defaultValue: null,
        ui: null,
      },
    ];

    const permissions = [
      {
        actionKey: "WRITE",
        effect: PlatformPermissionEffect.ALLOW,
        requiredPermissions: ["master.write"],
        conditionExpr: null,
      },
    ];

    const transitions = [
      {
        actionKey: "ACTIVATE",
        fromState: "DRAFT",
        toState: "ACTIVE",
        requiredPermissions: ["master.write"],
        conditions: null,
      },
    ];

    const first = compileMetaPayload({
      modelName: "Party",
      version: 2,
      fields: fields as never,
      permissions: permissions as never,
      transitions,
    });

    const second = compileMetaPayload({
      modelName: "Party",
      version: 2,
      fields: fields as never,
      permissions: permissions as never,
      transitions,
    });

    expect(first.etag).toBe(second.etag);
    expect(first.payload.validationSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["name"],
    });
  });

  it("changes etag when field structure changes", () => {
    const base = compileMetaPayload({
      modelName: "Item",
      version: 1,
      fields: [
        {
          fieldKey: "sku",
          label: "SKU",
          dataType: CustomFieldDataType.TEXT,
          required: true,
          readOnly: false,
          unique: true,
          sortOrder: 1,
          options: null,
          defaultValue: null,
          ui: null,
        },
      ] as never,
      permissions: [] as never,
      transitions: [],
    });

    const changed = compileMetaPayload({
      modelName: "Item",
      version: 1,
      fields: [
        {
          fieldKey: "sku",
          label: "SKU",
          dataType: CustomFieldDataType.TEXT,
          required: true,
          readOnly: false,
          unique: true,
          sortOrder: 1,
          options: null,
          defaultValue: null,
          ui: null,
        },
        {
          fieldKey: "barcode",
          label: "Barcode",
          dataType: CustomFieldDataType.TEXT,
          required: false,
          readOnly: false,
          unique: false,
          sortOrder: 2,
          options: null,
          defaultValue: null,
          ui: null,
        },
      ] as never,
      permissions: [] as never,
      transitions: [],
    });

    expect(base.etag).not.toBe(changed.etag);
  });

  it("validates custom data against compiled schema", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["sku"],
      properties: {
        sku: { type: "string" },
        active: { type: "boolean" },
      },
    };

    expect(() =>
      validateCustomDataWithCompiledSchema(schema, {
        sku: "SKU-1001",
        active: true,
      }),
    ).not.toThrow();

    expect(() => validateCustomDataWithCompiledSchema(schema, { active: true })).toThrowError(/required/i);
    expect(() =>
      validateCustomDataWithCompiledSchema(schema, {
        sku: "SKU-1001",
        unknown: "x",
      }),
    ).toThrowError(/unknown custom field/i);
  });
});
