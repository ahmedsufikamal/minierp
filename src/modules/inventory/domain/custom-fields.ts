import type { Prisma } from "@prisma/client";
import { InventoryError } from "@/modules/inventory/domain/errors";

export type CustomFieldDefinitionShape = {
  key: string;
  fieldType: string;
  required: boolean;
  config: Prisma.JsonValue | null;
};

function normalizeDate(value: unknown, withTime: boolean): string {
  if (!value) throw new InventoryError("VALIDATION_ERROR", "Date value is required");
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid date value");
  }
  return withTime ? date.toISOString() : date.toISOString().slice(0, 10);
}

export function validateCustomFieldValue(def: CustomFieldDefinitionShape, rawValue: unknown): Prisma.InputJsonValue {
  const value = rawValue ?? null;

  if (def.required && (value == null || value === "")) {
    throw new InventoryError("VALIDATION_ERROR", `Custom field '${def.key}' is required`);
  }

  if (value == null || value === "") {
    return null;
  }

  switch (def.fieldType) {
    case "TEXT":
    case "TEXTAREA":
    case "BARCODE":
      return String(value);
    case "NUMBER":
    case "CURRENCY": {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new InventoryError("VALIDATION_ERROR", `Custom field '${def.key}' must be numeric`);
      }
      return n;
    }
    case "BOOLEAN":
      return Boolean(value);
    case "DATE":
      return normalizeDate(value, false);
    case "DATETIME":
      return normalizeDate(value, true);
    case "SELECT": {
      const str = String(value);
      const options = (def.config as { options?: string[] } | null)?.options ?? [];
      if (options.length > 0 && !options.includes(str)) {
        throw new InventoryError("VALIDATION_ERROR", `Custom field '${def.key}' must be one of configured options`);
      }
      return str;
    }
    case "MULTISELECT": {
      const values = Array.isArray(value) ? value.map((v) => String(v)) : [String(value)];
      const options = (def.config as { options?: string[] } | null)?.options ?? [];
      if (options.length > 0 && values.some((v) => !options.includes(v))) {
        throw new InventoryError("VALIDATION_ERROR", `Custom field '${def.key}' contains invalid selection`);
      }
      return values;
    }
    case "JSON":
      return value as Prisma.InputJsonValue;
    case "USER":
    case "REFERENCE":
      return String(value);
    default:
      return value as Prisma.InputJsonValue;
  }
}
