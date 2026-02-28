import crypto from "node:crypto";
import { CustomFieldDataType, type MetaFieldDef, type MetaPermissionPolicy, type MetaWorkflowTransition } from "@prisma/client";
import { stableStringify } from "@/modules/platform/application/audit-ledger.service";
import { PlatformError } from "@/modules/platform/domain/errors";

type JsonSchema = Record<string, unknown>;

function toJsonSchemaType(dataType: CustomFieldDataType): string | string[] {
  switch (dataType) {
    case "NUMBER":
    case "CURRENCY":
      return "number";
    case "BOOLEAN":
      return "boolean";
    case "TABLE":
      return "array";
    case "JSON":
      return ["object", "array", "string", "number", "boolean", "null"];
    default:
      return "string";
  }
}

function propertySchema(field: Pick<MetaFieldDef, "dataType" | "label" | "options" | "defaultValue">): JsonSchema {
  const base: JsonSchema = {
    title: field.label,
    type: toJsonSchemaType(field.dataType),
  };

  if (field.dataType === "SELECT") {
    const options = (field.options && typeof field.options === "object"
      ? (field.options as { options?: unknown[] }).options
      : null) ?? [];
    if (Array.isArray(options) && options.length > 0) {
      base.enum = options.map((entry) => String(entry));
    }
  }

  if (field.defaultValue !== null && field.defaultValue !== undefined) {
    base.default = field.defaultValue;
  }

  return base;
}

export function compileMetaPayload(input: {
  modelName: string;
  version: number;
  fields: MetaFieldDef[];
  permissions: MetaPermissionPolicy[];
  transitions: Pick<MetaWorkflowTransition, "actionKey" | "fromState" | "toState" | "requiredPermissions" | "conditions">[];
}): {
  etag: string;
  payload: {
    modelName: string;
    version: number;
    validationSchema: JsonSchema;
    uiSchema: Record<string, unknown>;
    searchHints: Record<string, unknown>;
    permissionSummary: Record<string, unknown>;
    workflowSummary: Record<string, unknown>;
    indexHints: Record<string, unknown>;
  };
} {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of input.fields) {
    properties[field.fieldKey] = propertySchema(field);
    if (field.required) required.push(field.fieldKey);
  }

  const validationSchema: JsonSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };

  const uiSchema = {
    fields: input.fields
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((field) => ({
        key: field.fieldKey,
        label: field.label,
        type: field.dataType,
        required: field.required,
        readOnly: field.readOnly,
        ui: field.ui ?? null,
      })),
  };

  const searchHints = {
    searchableFields: input.fields
      .filter((field) => ["TEXT", "SELECT", "LINK"].includes(field.dataType))
      .map((field) => field.fieldKey),
  };

  const permissionSummary = {
    actions: input.permissions.map((policy) => ({
      actionKey: policy.actionKey,
      effect: policy.effect,
      requiredPermissions: policy.requiredPermissions ?? null,
      conditionExpr: policy.conditionExpr ?? null,
    })),
  };

  const workflowSummary = {
    transitions: input.transitions.map((transition) => ({
      actionKey: transition.actionKey,
      fromState: transition.fromState,
      toState: transition.toState,
      requiredPermissions: transition.requiredPermissions ?? null,
      conditions: transition.conditions ?? null,
    })),
  };

  const indexHints = {
    uniqueFieldKeys: input.fields.filter((field) => field.unique).map((field) => field.fieldKey),
  };

  const payload = {
    modelName: input.modelName,
    version: input.version,
    validationSchema,
    uiSchema,
    searchHints,
    permissionSummary,
    workflowSummary,
    indexHints,
  };

  const etag = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");

  return { etag, payload };
}

function matchesType(value: unknown, dataType: CustomFieldDataType): boolean {
  if (value === null || value === undefined) return true;

  switch (dataType) {
    case "NUMBER":
    case "CURRENCY":
      return typeof value === "number" && Number.isFinite(value);
    case "BOOLEAN":
      return typeof value === "boolean";
    case "DATE":
    case "DATETIME":
    case "TEXT":
    case "SELECT":
    case "LINK":
    case "TABLE":
      return typeof value === "string";
    case "JSON":
      return true;
    default:
      return true;
  }
}

export function validateCustomDataWithFieldDefs(
  fields: Pick<MetaFieldDef, "fieldKey" | "required" | "dataType">[],
  customData: Record<string, unknown> | null | undefined,
): void {
  if (!customData) {
    const required = fields.filter((field) => field.required);
    if (required.length > 0) {
      throw new PlatformError(
        "VALIDATION_ERROR",
        `Missing required custom fields: ${required.map((field) => field.fieldKey).join(", ")}`,
      );
    }
    return;
  }

  const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]));

  for (const field of fields) {
    const value = customData[field.fieldKey];
    if (field.required && (value === undefined || value === null || value === "")) {
      throw new PlatformError("VALIDATION_ERROR", `Custom field '${field.fieldKey}' is required`);
    }
  }

  for (const [key, value] of Object.entries(customData)) {
    const def = fieldByKey.get(key);
    if (!def) {
      throw new PlatformError("VALIDATION_ERROR", `Unknown custom field '${key}'`);
    }
    if (!matchesType(value, def.dataType)) {
      throw new PlatformError("VALIDATION_ERROR", `Invalid type for custom field '${key}'`);
    }
  }
}

function isJsonSchemaTypeMatch(value: unknown, schemaType: unknown): boolean {
  if (value === null || value === undefined) return true;

  const types = Array.isArray(schemaType) ? schemaType : [schemaType];
  for (const entry of types) {
    switch (entry) {
      case "string":
        if (typeof value === "string") return true;
        break;
      case "number":
        if (typeof value === "number" && Number.isFinite(value)) return true;
        break;
      case "boolean":
        if (typeof value === "boolean") return true;
        break;
      case "array":
        if (Array.isArray(value)) return true;
        break;
      case "object":
        if (value && typeof value === "object" && !Array.isArray(value)) return true;
        break;
      case "null":
        if (value === null) return true;
        break;
      default:
        break;
    }
  }
  return false;
}

export function validateCustomDataWithCompiledSchema(
  validationSchema: unknown,
  customData: Record<string, unknown> | null | undefined,
): void {
  if (!validationSchema || typeof validationSchema !== "object" || Array.isArray(validationSchema)) {
    throw new PlatformError("VALIDATION_ERROR", "Compiled validation schema is invalid");
  }

  const schema = validationSchema as {
    properties?: Record<string, { type?: unknown }>;
    required?: string[];
    additionalProperties?: boolean;
  };

  const payload = customData ?? {};
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new PlatformError("VALIDATION_ERROR", "customData must be an object");
  }

  const properties = schema.properties ?? {};
  const requiredKeys = Array.isArray(schema.required) ? schema.required : [];
  const additionalPropsAllowed = schema.additionalProperties !== false;

  for (const key of requiredKeys) {
    const value = payload[key];
    if (value === undefined || value === null || value === "") {
      throw new PlatformError("VALIDATION_ERROR", `Custom field '${key}' is required`);
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    const property = properties[key];
    if (!property) {
      if (!additionalPropsAllowed) {
        throw new PlatformError("VALIDATION_ERROR", `Unknown custom field '${key}'`);
      }
      continue;
    }

    if (!isJsonSchemaTypeMatch(value, property.type)) {
      throw new PlatformError("VALIDATION_ERROR", `Invalid type for custom field '${key}'`);
    }
  }
}
