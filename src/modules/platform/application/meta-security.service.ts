import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const allowedJsonLogicOps = new Set([
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "and",
  "or",
  "!",
  "in",
  "var",
  "+",
  "-",
  "*",
  "/",
  "%",
  "min",
  "max",
  "if",
]);

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function stripUnsafeHtml(value: string): string {
  // Minimal sanitization for server-rendered previews.
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function resolvePath(input: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = input;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function renderMustacheStrict(template: string, values: Record<string, unknown>): string {
  if (template.includes("{{{") || template.includes("}}}")) {
    throw new PlatformError("VALIDATION_ERROR", "Unescaped template tokens are not allowed");
  }

  return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_all, key: string) => {
    const value = resolvePath(values, key);
    if (value === undefined || value === null) {
      throw new PlatformError("VALIDATION_ERROR", `Missing template variable: ${key}`);
    }
    return htmlEscape(String(value));
  });
}

function walkJsonLogic(input: unknown, depth: number): void {
  if (depth > 20) {
    throw new PlatformError("VALIDATION_ERROR", "Expression depth limit exceeded");
  }

  if (Array.isArray(input)) {
    input.forEach((entry) => walkJsonLogic(entry, depth + 1));
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1) {
    throw new PlatformError("VALIDATION_ERROR", "JSONLogic expression object must contain one operator");
  }

  const [op] = keys;
  if (!allowedJsonLogicOps.has(op)) {
    throw new PlatformError("VALIDATION_ERROR", `Unsupported JSONLogic operator: ${op}`);
  }

  walkJsonLogic(record[op], depth + 1);
}

export function validateJsonLogicExpression(expression: unknown): void {
  if (expression === null || expression === undefined) return;
  walkJsonLogic(expression, 0);
}

export function assertPermissionCeiling(ctx: PlatformRequestContext, requiredPermissions: string[]): void {
  if (ctx.platformRole === "SUPER_ADMIN") return;
  const denied = requiredPermissions.filter((permission) => !ctx.permissions.includes(permission));
  if (denied.length > 0) {
    throw new PlatformError(
      "FORBIDDEN",
      `Metadata cannot require permissions caller does not have: ${denied.join(", ")}`,
    );
  }
}

export function piiMasked(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "****";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}
